import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MessagingService } from './messaging.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { MessageQueryDto } from './dto/message-query.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Direct Messaging Hub')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/conversations')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get or start a direct conversation with another user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conversation retrieved or created successfully',
  })
  getOrCreateDirectConversation(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagingService.getOrCreateDirectConversation(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all conversations for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conversations list retrieved successfully',
  })
  getUserConversations(@CurrentUser('id') userId: string) {
    return this.messagingService.getUserConversations(userId);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get total unread message count across all conversations',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Total unread count retrieved successfully',
  })
  getTotalUnreadCount(@CurrentUser('id') userId: string) {
    return this.messagingService.getTotalUnreadCount(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get conversation details and messages (auto-marks as read)',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the conversation',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conversation details retrieved successfully',
  })
  getConversationDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Query() query: MessageQueryDto,
  ) {
    return this.messagingService.getConversationDetails(id, userId, query);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a message in a conversation',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the conversation',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Message sent successfully',
  })
  sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') senderId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagingService.sendMessage(id, senderId, dto);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark conversation messages as read',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the conversation',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conversation marked as read successfully',
  })
  markConversationAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.messagingService.markConversationAsRead(id, userId);
  }
}
