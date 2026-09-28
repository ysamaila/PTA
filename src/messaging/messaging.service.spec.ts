import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MessagingService } from './messaging.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { ConversationType, Role } from '../common/enums/index.js';

describe('MessagingService', () => {
  let service: MessagingService;

  const user1Id = 'user-uuid-1';
  const user2Id = 'user-uuid-2';
  const conversationId = 'conv-uuid-1';

  const mockUser2 = {
    id: user2Id,
    email: 'teacher@school.edu',
    role: Role.TEACHER,
  };

  const mockConversation = {
    id: conversationId,
    type: ConversationType.DIRECT,
    title: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    participants: [
      {
        userId: user1Id,
        lastReadAt: new Date(),
        user: {
          id: user1Id,
          email: 'parent@school.edu',
          role: Role.PARENT,
          parentProfile: { fullName: 'Parent User', schoolName: 'Afrotech' },
          teacherProfile: null,
          studentProfile: null,
        },
      },
      {
        userId: user2Id,
        lastReadAt: null,
        user: {
          id: user2Id,
          email: 'teacher@school.edu',
          role: Role.TEACHER,
          parentProfile: null,
          teacherProfile: { fullName: 'Teacher User', schoolName: 'Afrotech' },
          studentProfile: null,
        },
      },
    ],
    messages: [
      {
        id: 'msg-1',
        conversationId,
        senderId: user1Id,
        body: 'Hello teacher',
        isDelivered: true,
        createdAt: new Date(),
      },
    ],
  };

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    conversation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    conversationParticipant: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: {
      create: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((promises) => Promise.all(promises)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
  });

  describe('getOrCreateDirectConversation', () => {
    it('returns existing direct conversation if one already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser2);
      mockPrisma.conversation.findFirst.mockResolvedValue(mockConversation);

      const result = await service.getOrCreateDirectConversation(user1Id, {
        recipientUserId: user2Id,
      });

      expect(result).toEqual(mockConversation);
      expect(mockPrisma.conversation.create).not.toHaveBeenCalled();
    });

    it('creates new conversation if none exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser2);
      mockPrisma.conversation.findFirst.mockResolvedValue(null);
      mockPrisma.conversation.create.mockResolvedValue(mockConversation);

      const result = await service.getOrCreateDirectConversation(user1Id, {
        recipientUserId: user2Id,
      });

      expect(result).toEqual(mockConversation);
      expect(mockPrisma.conversation.create).toHaveBeenCalled();
    });

    it('throws BadRequestException if recipient is same as caller', async () => {
      await expect(
        service.getOrCreateDirectConversation(user1Id, {
          recipientUserId: user1Id,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if recipient user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrCreateDirectConversation(user1Id, {
          recipientUserId: 'non-existent-user',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserConversations', () => {
    it('returns conversations with unread counts and recipient profile', async () => {
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([
        {
          userId: user1Id,
          lastReadAt: new Date('2026-09-01'),
          conversation: mockConversation,
        },
      ]);
      mockPrisma.message.count.mockResolvedValue(2);

      const result = await service.getUserConversations(user1Id);

      expect(result).toHaveLength(1);
      expect(result[0].unreadCount).toBe(2);
      expect(result[0].recipient?.displayName).toBe('Teacher User');
    });
  });

  describe('getConversationDetails', () => {
    it('returns conversation details and auto marks as read', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({
        conversationId,
        userId: user1Id,
      });
      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await service.getConversationDetails(
        conversationId,
        user1Id,
      );

      expect(result.id).toBe(conversationId);
      expect(mockPrisma.conversationParticipant.update).toHaveBeenCalledWith({
        where: {
          conversationId_userId: { conversationId, userId: user1Id },
        },
        data: expect.objectContaining({ lastReadAt: expect.any(Date) }),
      });
    });

    it('throws ForbiddenException if user is not participant', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.getConversationDetails(conversationId, 'intruder-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('sendMessage', () => {
    it('creates message and updates conversation timestamp', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({
        conversationId,
        userId: user1Id,
      });
      const createdMsg = {
        id: 'msg-new',
        conversationId,
        senderId: user1Id,
        body: 'New test message',
        isDelivered: true,
        createdAt: new Date(),
      };
      mockPrisma.message.create.mockReturnValue(createdMsg);

      const result = await service.sendMessage(conversationId, user1Id, {
        body: 'New test message',
      });

      expect(result).toEqual(createdMsg);
    });

    it('throws ForbiddenException if sender is not participant', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage(conversationId, 'intruder-user', {
          body: 'Hello',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markConversationAsRead', () => {
    it('updates lastReadAt for participant', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({
        conversationId,
        userId: user1Id,
      });

      const result = await service.markConversationAsRead(
        conversationId,
        user1Id,
      );

      expect(result).toEqual({ message: 'Conversation marked as read' });
      expect(mockPrisma.conversationParticipant.update).toHaveBeenCalled();
    });
  });

  describe('getTotalUnreadCount', () => {
    it('sums unread messages across all conversations', async () => {
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([
        { conversationId: 'c1', lastReadAt: new Date() },
        { conversationId: 'c2', lastReadAt: null },
      ]);
      mockPrisma.message.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);

      const result = await service.getTotalUnreadCount(user1Id);

      expect(result).toEqual({ unreadCount: 5 });
    });
  });
});
