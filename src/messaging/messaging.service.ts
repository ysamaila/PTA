import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { MessageQueryDto } from './dto/message-query.dto.js';
import { ConversationType } from '../common/enums/index.js';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateDirectConversation(
    userId: string,
    dto: CreateConversationDto,
  ) {
    if (userId === dto.recipientUserId) {
      throw new BadRequestException(
        'Cannot initiate a direct conversation with yourself',
      );
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: dto.recipientUserId },
      select: { id: true, email: true, role: true },
    });

    if (!recipient) {
      throw new NotFoundException(
        `Recipient user with ID ${dto.recipientUserId} not found`,
      );
    }

    // Check if a direct conversation already exists between these two users
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        AND: [
          {
            participants: {
              some: { userId },
            },
          },
          {
            participants: {
              some: { userId: dto.recipientUserId },
            },
          },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                parentProfile: { select: { fullName: true, schoolName: true } },
                teacherProfile: {
                  select: { fullName: true, schoolName: true },
                },
                studentProfile: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (existing) {
      if (dto.initialMessage?.trim()) {
        await this.sendMessage(existing.id, userId, {
          body: dto.initialMessage.trim(),
        });
      }
      return existing;
    }

    const created = await this.prisma.conversation.create({
      data: {
        type: ConversationType.DIRECT,
        participants: {
          create: [
            { userId, lastReadAt: new Date() },
            { userId: dto.recipientUserId },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                parentProfile: { select: { fullName: true, schoolName: true } },
                teacherProfile: {
                  select: { fullName: true, schoolName: true },
                },
                studentProfile: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });

    if (dto.initialMessage?.trim()) {
      await this.sendMessage(created.id, userId, {
        body: dto.initialMessage.trim(),
      });
    }

    this.logger.log(
      `Created direct conversation ${created.id} between ${userId} and ${dto.recipientUserId}`,
    );

    return created;
  }

  async getUserConversations(userId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    role: true,
                    parentProfile: {
                      select: { fullName: true, schoolName: true },
                    },
                    teacherProfile: {
                      select: { fullName: true, schoolName: true },
                    },
                    studentProfile: {
                      select: { firstName: true, lastName: true },
                    },
                  },
                },
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: {
        conversation: {
          updatedAt: 'desc',
        },
      },
    });

    const result = await Promise.all(
      participants.map(async (p) => {
        const conv = p.conversation;
        const otherParticipant = conv.participants.find(
          (part) => part.userId !== userId,
        );
        const lastMessage = conv.messages[0] || null;

        // Calculate unread messages
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            ...(p.lastReadAt && {
              createdAt: { gt: p.lastReadAt },
            }),
          },
        });

        // Resolve display name for the other party
        let otherUserName = otherParticipant?.user.email || 'User';
        if (otherParticipant?.user.teacherProfile?.fullName) {
          otherUserName = otherParticipant.user.teacherProfile.fullName;
        } else if (otherParticipant?.user.parentProfile?.fullName) {
          otherUserName = otherParticipant.user.parentProfile.fullName;
        } else if (
          otherParticipant?.user.studentProfile?.firstName &&
          otherParticipant?.user.studentProfile?.lastName
        ) {
          otherUserName = `${otherParticipant.user.studentProfile.firstName} ${otherParticipant.user.studentProfile.lastName}`;
        }

        return {
          id: conv.id,
          type: conv.type,
          title: conv.title,
          updatedAt: conv.updatedAt,
          createdAt: conv.createdAt,
          lastReadAt: p.lastReadAt,
          unreadCount,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                senderId: lastMessage.senderId,
                body: lastMessage.body,
                createdAt: lastMessage.createdAt,
              }
            : null,
          recipient: otherParticipant
            ? {
                userId: otherParticipant.user.id,
                email: otherParticipant.user.email,
                role: otherParticipant.user.role,
                displayName: otherUserName,
              }
            : null,
        };
      }),
    );

    return result;
  }

  async getConversationDetails(
    conversationId: string,
    userId: string,
    query?: MessageQueryDto,
  ) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException(
        'You are not authorized to view messages in this conversation',
      );
    }

    // Auto mark as read upon viewing details
    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                parentProfile: { select: { fullName: true } },
                teacherProfile: { select: { fullName: true } },
                studentProfile: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        messages: {
          take: query?.limit || 50,
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            senderId: true,
            body: true,
            isDelivered: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found`,
      );
    }

    return conversation;
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    dto: SendMessageDto,
  ) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: senderId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException(
        'You cannot send messages to a conversation you are not a participant in',
      );
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          senderId,
          body: dto.body.trim(),
          isDelivered: true,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
      this.prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: senderId,
          },
        },
        data: {
          lastReadAt: new Date(),
        },
      }),
    ]);

    return message;
  }

  async markConversationAsRead(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return { message: 'Conversation marked as read' };
  }

  async getTotalUnreadCount(userId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      select: {
        conversationId: true,
        lastReadAt: true,
      },
    });

    let totalUnread = 0;
    for (const p of participants) {
      const count = await this.prisma.message.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: userId },
          ...(p.lastReadAt && {
            createdAt: { gt: p.lastReadAt },
          }),
        },
      });
      totalUnread += count;
    }

    return { unreadCount: totalUnread };
  }
}
