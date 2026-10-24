# Chat Fix — FIX14

## Root causes
1. The frontend opened Socket.IO without passing the JWT token. The backend correctly rejected unauthenticated sockets.
2. The frontend sent `receiverId`, while the server handler read `recipientId`, so the recipient became undefined and inserts failed.
3. The user list endpoint returned users from every company instead of limiting employees to the authenticated user's company.
4. The realtime layer did not validate recipient/company scope before persisting a message.

## Fixes
- Socket.IO now receives the JWT via `auth.token`.
- Chat payload uses `receiverId`; sender identity always comes from the verified JWT.
- Server validates recipient, prevents self-messaging, rejects empty messages, and enforces same-company chat scope.
- Chat user list is limited to the authenticated user's company.
- Messages are persisted in PostgreSQL in `chat_messages` before realtime delivery.
- Added conversation and unread-message indexes.
- Existing foreign keys keep messages tied to users and cascade deleted users safely.
