let ioInstance = null;

export function initSocket(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log('⚡ Client connected:', socket.id);

    // Join room channel e.g. "room_1"
    socket.on('join_room', (roomId) => {
      if (roomId) {
        socket.join(`room_${roomId}`);
        console.log(`Socket ${socket.id} joined room_${roomId}`);
      }
    });

    // Leave room channel
    socket.on('leave_room', (roomId) => {
      if (roomId) {
        socket.leave(`room_${roomId}`);
      }
    });

    // Join user personal channel e.g. "user_2"
    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`Socket ${socket.id} joined user_${userId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}

export function getIO() {
  return ioInstance;
}

export function emitToRoom(roomId, event, data) {
  if (ioInstance && roomId) {
    ioInstance.to(`room_${roomId}`).emit(event, data);
  }
}

export function emitToUser(userId, event, data) {
  if (ioInstance && userId) {
    ioInstance.to(`user_${userId}`).emit(event, data);
  }
}

export function broadcastQuotaUpdate(roomId, drawPeriodId, quotaData) {
  if (ioInstance && roomId) {
    ioInstance.to(`room_${roomId}`).emit('quota_updated', {
      roomId,
      drawPeriodId,
      quotaData,
      timestamp: new Date().toISOString()
    });
  }
}

export function emitSimulatedLineEvent(eventData) {
  if (ioInstance) {
    ioInstance.emit('simulated_line_event', eventData);
  }
}
