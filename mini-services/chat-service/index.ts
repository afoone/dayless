import { Server } from 'socket.io'

const io = new Server(3005, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// Track online users per team
const teamUsers = new Map<string, Map<string, { socketId: string; memberName: string; memberId: string }>>()

function getTeamRoom(teamId: string) {
  return `team:${teamId}`
}

function getOnlineCount(teamId: string): number {
  return teamUsers.get(teamId)?.size || 0
}

function getOnlineMembers(teamId: string): { memberId: string; memberName: string }[] {
  const users = teamUsers.get(teamId)
  if (!users) return []
  return Array.from(users.values()).map(u => ({ memberId: u.memberId, memberName: u.memberName }))
}

io.on('connection', (socket) => {
  console.log(`[Chat] Client connected: ${socket.id}`)

  // Join a team room
  socket.on('join:team', (data: { teamId: string; memberId: string; memberName: string }) => {
    const { teamId, memberId, memberName } = data
    const room = getTeamRoom(teamId)

    // Leave previous rooms
    for (const [roomId, users] of teamUsers.entries()) {
      const userEntry = users.get(memberId)
      if (userEntry && userEntry.socketId === socket.id) {
        users.delete(memberId)
        if (users.size === 0) teamUsers.delete(roomId)
        socket.leave(roomId)
      }
    }

    // Join new room
    socket.join(room)

    // Track user
    if (!teamUsers.has(teamId)) {
      teamUsers.set(teamId, new Map())
    }
    teamUsers.get(teamId)!.set(memberId, { socketId: socket.id, memberName, memberId })

    // Notify others
    socket.to(room).emit('presence:update', {
      teamId,
      onlineMembers: getOnlineMembers(teamId),
      onlineCount: getOnlineCount(teamId),
    })

    // Send current online list to the joining user
    socket.emit('presence:update', {
      teamId,
      onlineMembers: getOnlineMembers(teamId),
      onlineCount: getOnlineCount(teamId),
    })

    console.log(`[Chat] ${memberName} joined team ${teamId} (${getOnlineCount(teamId)} online)`)
  })

  // Leave a team room
  socket.on('leave:team', (data: { teamId: string; memberId: string }) => {
    const { teamId, memberId } = data
    const room = getTeamRoom(teamId)
    socket.leave(room)

    const users = teamUsers.get(teamId)
    if (users) {
      users.delete(memberId)
      if (users.size === 0) teamUsers.delete(teamId)
    }

    socket.to(room).emit('presence:update', {
      teamId,
      onlineMembers: getOnlineMembers(teamId),
      onlineCount: getOnlineCount(teamId),
    })

    console.log(`[Chat] ${memberId} left team ${teamId}`)
  })

  // Receive and broadcast message
  socket.on('send:message', (data: { teamId: string; senderId: string; senderName: string; senderType: string; content: string }) => {
    const { teamId, ...messageData } = data
    const room = getTeamRoom(teamId)
    const timestamp = new Date().toISOString()

    const message = {
      id: `msg-${Date.now()}`,
      ...messageData,
      teamId,
      createdAt: timestamp,
    }

    // Broadcast to everyone in room EXCEPT sender
    socket.to(room).emit('new:message', message)

    // Acknowledge to sender
    socket.emit('message:ack', message)

    console.log(`[Chat] Message from ${messageData.senderName} in team ${teamId}`)
  })

  // Typing indicators
  socket.on('typing:start', (data: { teamId: string; senderName: string; senderId: string }) => {
    const room = getTeamRoom(data.teamId)
    socket.to(room).emit('typing:start', { memberName: data.senderName, memberId: data.senderId })
  })

  socket.on('typing:stop', (data: { teamId: string; senderId: string }) => {
    const room = getTeamRoom(data.teamId)
    socket.to(room).emit('typing:stop', { memberId: data.senderId })
  })

  // Standup submitted
  socket.on('standup:submitted', (data: { teamId: string; memberName: string; standup: object }) => {
    const room = getTeamRoom(data.teamId)
    socket.to(room).emit('standup:submitted', data)
  })

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[Chat] Client disconnected: ${socket.id}`)

    // Remove from all team rooms
    for (const [teamId, users] of teamUsers.entries()) {
      for (const [memberId, user] of users.entries()) {
        if (user.socketId === socket.id) {
          users.delete(memberId)
          if (users.size === 0) {
            teamUsers.delete(teamId)
          } else {
            const room = getTeamRoom(teamId)
            io.to(room).emit('presence:update', {
              teamId,
              onlineMembers: getOnlineMembers(teamId),
              onlineCount: getOnlineCount(teamId),
            })
          }
          break
        }
      }
    }
  })
})

console.log('[Chat] Chat service running on port 3005')
