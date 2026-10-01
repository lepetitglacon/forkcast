import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type * as Y from 'yjs';
import { createDoc, docFromState, encodeDocState, getMeta, isInitialized } from '@forkcast/doc';
import type { CreateInvitationInput, CreateTreeInput, InvitationDto, InvitationPreviewDto, MemberDto, Role, TreeMetaDto } from '@forkcast/shared';
import { randomToken } from '../common/crypto';
import { UsersService } from '../users/users.service';
import { AccessService, roleAtLeast } from './access.service';
import { Invitation, Membership, TreeEntity, TreeDocument } from './schemas';
import { YDocStoreService } from './ydoc-store.service';

@Injectable()
export class TreesService {
  constructor(
    @InjectModel(TreeEntity.name) private readonly trees: Model<TreeEntity>,
    @InjectModel(Membership.name) private readonly memberships: Model<Membership>,
    @InjectModel(Invitation.name) private readonly invitations: Model<Invitation>,
    private readonly store: YDocStoreService,
    private readonly users: UsersService,
    private readonly access: AccessService,
  ) {}

  toDto(tree: TreeDocument, role: Role): TreeMetaDto {
    return {
      id: tree._id.toString(),
      title: tree.title,
      ownerId: tree.ownerId,
      role,
      createdAt: tree.createdAt.toISOString(),
      updatedAt: tree.updatedAt.toISOString(),
    };
  }

  async list(userId: string): Promise<TreeMetaDto[]> {
    const memberships = await this.memberships.find({ userId }).lean().exec();
    const roles = new Map(memberships.map((m) => [m.treeId, m.role]));
    const trees = await this.trees
      .find({ _id: { $in: [...roles.keys()] } })
      .sort({ updatedAt: -1 })
      .exec();
    return trees.map((t) => this.toDto(t, roles.get(t._id.toString()) ?? 'viewer'));
  }

  /** Create a tree with its initial Yjs state (given by the client, or a fresh document). */
  async create(userId: string, input: CreateTreeInput): Promise<TreeMetaDto> {
    let state: Uint8Array;
    if (input.initialState) {
      let doc: Y.Doc;
      try {
        doc = docFromState(new Uint8Array(Buffer.from(input.initialState, 'base64')));
      } catch {
        throw new BadRequestException({ statusCode: 400, message: 'initialState is not a valid Yjs update.', code: 'VALIDATION' });
      }
      if (!isInitialized(doc)) throw new BadRequestException({ statusCode: 400, message: 'initialState does not contain an initialized tree.', code: 'VALIDATION' });
      state = encodeDocState(doc);
    } else {
      state = encodeDocState(createDoc({ title: input.title }, 'system'));
    }
    return this.createWithState(userId, input.title, state);
  }

  async createWithState(userId: string, title: string, state: Uint8Array): Promise<TreeMetaDto> {
    const tree = await this.trees.create({ title, ownerId: userId });
    const treeId = tree._id.toString();
    await this.memberships.create({ treeId, userId, role: 'owner' });
    await this.store.save(treeId, state);
    return this.toDto(tree, 'owner');
  }

  async get(userId: string, treeId: string): Promise<TreeMetaDto> {
    const { tree, role } = await this.access.requireRole(userId, treeId, 'viewer');
    return this.toDto(tree, role);
  }

  async findById(treeId: string): Promise<TreeDocument | null> {
    return this.access.findTree(treeId);
  }

  /** Update metadata (title, updatedAt) from the persisted document. */
  async touch(treeId: string, title?: string): Promise<void> {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined && title.trim().length > 0) update['title'] = title.trim();
    await this.trees.updateOne({ _id: treeId }, { $set: update }, { timestamps: false }).exec();
  }

  async rename(userId: string, treeId: string, title: string): Promise<TreeMetaDto> {
    const { tree, role } = await this.access.requireRole(userId, treeId, 'editor');
    tree.title = title;
    await tree.save();
    return this.toDto(tree, role);
  }

  async remove(userId: string, treeId: string): Promise<void> {
    await this.access.requireRole(userId, treeId, 'owner');
    await Promise.all([
      this.trees.deleteOne({ _id: treeId }).exec(),
      this.memberships.deleteMany({ treeId }).exec(),
      this.invitations.deleteMany({ treeId }).exec(),
      this.store.remove(treeId),
    ]);
  }

  async members(userId: string, treeId: string): Promise<MemberDto[]> {
    await this.access.requireRole(userId, treeId, 'viewer');
    const memberships = await this.memberships.find({ treeId }).lean().exec();
    const users = await this.users.findManyByIds(memberships.map((m) => m.userId));
    const byId = new Map(users.map((u) => [u._id.toString(), u]));
    return memberships
      .map((m) => {
        const u = byId.get(m.userId);
        return { userId: m.userId, email: u?.email ?? '', name: u?.name ?? '?', role: m.role };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async updateMember(userId: string, treeId: string, targetUserId: string, role: 'editor' | 'viewer'): Promise<MemberDto> {
    await this.access.requireRole(userId, treeId, 'owner');
    const target = await this.memberships.findOne({ treeId, userId: targetUserId }).exec();
    if (!target) throw new NotFoundException({ statusCode: 404, message: 'Membre introuvable.', code: 'MEMBER_NOT_FOUND' });
    if (target.role === 'owner') throw new ForbiddenException({ statusCode: 403, message: 'Le rôle du propriétaire ne peut pas être modifié.', code: 'OWNER_IMMUTABLE' });
    target.role = role;
    await target.save();
    const user = await this.users.findById(targetUserId);
    return { userId: targetUserId, email: user?.email ?? '', name: user?.name ?? '?', role };
  }

  async removeMember(userId: string, treeId: string, targetUserId: string): Promise<void> {
    const { role } = await this.access.requireRole(userId, treeId, 'viewer');
    const target = await this.memberships.findOne({ treeId, userId: targetUserId }).exec();
    if (!target) throw new NotFoundException({ statusCode: 404, message: 'Membre introuvable.', code: 'MEMBER_NOT_FOUND' });
    if (target.role === 'owner') throw new ForbiddenException({ statusCode: 403, message: 'Le propriétaire ne peut pas être retiré.', code: 'OWNER_IMMUTABLE' });
    const self = targetUserId === userId;
    if (!self && role !== 'owner') throw new ForbiddenException({ statusCode: 403, message: 'Seul le propriétaire peut retirer un membre.', code: 'FORBIDDEN' });
    await target.deleteOne();
  }

  async createInvitation(userId: string, treeId: string, input: CreateInvitationInput): Promise<InvitationDto> {
    await this.access.requireRole(userId, treeId, 'editor');
    const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 24 * 7) * 3600 * 1000);
    const invitation = await this.invitations.create({ token: randomToken(32), treeId, role: input.role, createdBy: userId, expiresAt });
    return { token: invitation.token, treeId, role: invitation.role, expiresAt: expiresAt.toISOString() };
  }

  private async validInvitation(token: string): Promise<{ invitation: Invitation; tree: TreeDocument }> {
    const invitation = await this.invitations.findOne({ token }).lean().exec();
    if (!invitation || invitation.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException({ statusCode: 404, message: 'Invitation introuvable ou expirée.', code: 'INVITATION_INVALID' });
    }
    const tree = await this.access.findTree(invitation.treeId);
    if (!tree) throw new NotFoundException({ statusCode: 404, message: "L'arbre de cette invitation n'existe plus.", code: 'TREE_NOT_FOUND' });
    return { invitation, tree };
  }

  async previewInvitation(token: string): Promise<InvitationPreviewDto> {
    const { invitation, tree } = await this.validInvitation(token);
    const inviter = await this.users.findById(invitation.createdBy);
    return { treeId: tree._id.toString(), title: tree.title, role: invitation.role, invitedBy: inviter?.name ?? '?' };
  }

  async acceptInvitation(userId: string, token: string): Promise<TreeMetaDto> {
    const { invitation, tree } = await this.validInvitation(token);
    const treeId = tree._id.toString();
    const existing = await this.memberships.findOne({ treeId, userId }).exec();
    let role: Role = invitation.role;
    if (existing) {
      if (roleAtLeast(existing.role, invitation.role)) role = existing.role;
      else {
        existing.role = invitation.role;
        await existing.save();
      }
    } else {
      await this.memberships.create({ treeId, userId, role });
    }
    return this.toDto(tree, role);
  }

  /** Title stored in the Yjs document (used to keep metadata in sync). */
  static titleOf(doc: Y.Doc): string | undefined {
    const title = getMeta(doc).get('title');
    return typeof title === 'string' ? title : undefined;
  }
}
