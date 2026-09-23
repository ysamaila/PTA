import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, AccountStatus } from '../enums/index.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
  isEmailVerified?: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      return null;
    }
    return data ? user[data] : user;
  },
);
