import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import type { Role } from '@forkcast/shared';
import { Membership, TreeEntity, TreeDocument } from './schemas';

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

@Injectable()
export class AccessService {
  constructor(
    @InjectModel(TreeEntity.name) private readonly trees: Model<TreeEntity>,
    @InjectModel(Membership.name) private readonly memberships: Model<Membership>,
  ) {}

  async findTree(treeId: string): Promise<TreeDocument | null> {
    if (!isValidObjectId(treeId)) return null;
    return this.trees.findById(treeId).exec();
  }

  /** Role of a user on a tree, or null when not a member (or tree missing). */
  async getRole(userId: string, treeId: string): Promise<Role | null> {
    if (!isValidObjectId(treeId)) return null;
    const m = await this.memberships.findOne({ treeId, userId }).lean().exec();
    return m?.role ?? null;
  }

  /** Throws 404 when the tree does not exist, 403 when the role is insufficient. */
  async requireRole(userId: string, treeId: string, minimum: Role): Promise<{ tree: TreeDocument; role: Role }> {
    const tree = await this.findTree(treeId);
    if (!tree) throw new NotFoundException({ statusCode: 404, message: `Arbre "${treeId}" introuvable.`, code: 'TREE_NOT_FOUND' });
    const role = await this.getRole(userId, treeId);
    if (!role || !roleAtLeast(role, minimum)) {
      throw new ForbiddenException({ statusCode: 403, message: `Droits insuffisants sur cet arbre (requis : ${minimum}).`, code: 'FORBIDDEN' });
    }
    return { tree, role };
  }
}
