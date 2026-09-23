import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { Role, AccountStatus } from '../enums/index.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (user?: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access if no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const ctx = createMockContext();

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw UnauthorizedException if user is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.TEACHER]);
    const ctx = createMockContext(null);

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should allow access if user has the required role and active status', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.TEACHER]);
    const ctx = createMockContext({
      id: 'teacher_1',
      role: Role.TEACHER,
      accountStatus: AccountStatus.ACTIVE,
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny access if user has a different role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.TEACHER]);
    const ctx = createMockContext({
      id: 'parent_1',
      role: Role.PARENT,
      accountStatus: AccountStatus.ACTIVE,
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should allow access if endpoint permits multiple roles and user matches one', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.PARENT, Role.TEACHER]);
    const ctx = createMockContext({
      id: 'parent_1',
      role: Role.PARENT,
      accountStatus: AccountStatus.ACTIVE,
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny access if account is suspended', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.PARENT]);
    const ctx = createMockContext({
      id: 'parent_1',
      role: Role.PARENT,
      accountStatus: AccountStatus.SUSPENDED,
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
