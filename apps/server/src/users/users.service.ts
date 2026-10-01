import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { UserDto } from '@forkcast/shared';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly model: Model<User>) {}

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.model.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.model.findById(id).exec();
  }

  findManyByIds(ids: string[]): Promise<UserDocument[]> {
    return this.model.find({ _id: { $in: ids } }).exec();
  }

  create(input: { email: string; passwordHash: string; name: string; color: string }): Promise<UserDocument> {
    return this.model.create(input);
  }

  toDto(user: UserDocument): UserDto {
    return { id: user._id.toString(), email: user.email, name: user.name, color: user.color };
  }
}
