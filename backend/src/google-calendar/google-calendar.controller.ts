import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Req } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';

type AuthedReq = { user: { userId: string } };

@Controller('google-calendar')
export class GoogleCalendarController {
  constructor(private readonly calendarService: GoogleCalendarService) {}

  @Get('events')
  async listEvents(
    @Req() req: AuthedReq,
    @Query('maxResults') maxResults?: string,
    @Query('timeMin') timeMin?: string,
    @Query('timeMax') timeMax?: string,
  ) {
    return this.calendarService.listEvents(req.user.userId, {
      maxResults: maxResults ? parseInt(maxResults, 10) : 100,
      timeMin,
      timeMax,
    });
  }

  @Post('events')
  async createEvent(@Req() req: AuthedReq, @Body() body: any) {
    return this.calendarService.createEvent(req.user.userId, body);
  }

  @Patch('events/:id')
  async updateEvent(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: any) {
    return this.calendarService.updateEvent(req.user.userId, id, body);
  }

  @Delete('events/:id')
  async deleteEvent(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.calendarService.deleteEvent(req.user.userId, id);
  }

  @Get('tasklists')
  async listTaskLists(@Req() req: AuthedReq) {
    return this.calendarService.listTaskLists(req.user.userId);
  }

  @Post('tasks')
  async createTask(@Req() req: AuthedReq, @Body() body: { taskListId: string; title: string; notes?: string; due?: string }) {
    return this.calendarService.createTask(req.user.userId, body.taskListId, body.title, body.notes, body.due);
  }

  @Post('link')
  async linkEvent(
    @Req() req: AuthedReq,
    @Body() body: {
      attendees: { name?: string; email: string }[];
      eventTitle: string;
      eventDescription?: string;
      eventDate: string;
      eventStartTime?: string;
    },
  ) {
    return this.calendarService.linkEvent({
      ...body,
      assignedTo: req.user.userId,
    });
  }
}
