import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { YDocState } from './schemas';

/** Persistence of Yjs binary states in MongoDB (used by the Hocuspocus Database extension). */
@Injectable()
export class YDocStoreService {
  constructor(@InjectModel(YDocState.name) private readonly model: Model<YDocState>) {}

  async load(name: string): Promise<Uint8Array | null> {
    const doc = await this.model.findOne({ name }).lean().exec();
    if (!doc) return null;
    const buf = doc.state as unknown as Buffer | { buffer: Buffer };
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from((buf as { buffer: Buffer }).buffer);
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  }

  async save(name: string, state: Uint8Array): Promise<void> {
    await this.model
      .updateOne({ name }, { $set: { state: Buffer.from(state), updatedAt: new Date() } }, { upsert: true })
      .exec();
  }

  async remove(name: string): Promise<void> {
    await this.model.deleteOne({ name }).exec();
  }
}
