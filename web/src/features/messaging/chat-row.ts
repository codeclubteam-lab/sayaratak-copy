// One line of a thread: a stored message, or one the person just sent that the server has not confirmed yet.
export type ChatRow = {
  id: string
  senderId: string
  body: string
  createdAt: string
  readAt?: string
  state?: "sending" | "failed"
}
