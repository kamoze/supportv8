import { authBotChallenge, authJson, botProofFailure } from "@/lib/auth/bot-challenge";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try { return await authBotChallenge.start(request, await authJson(request)); }
  catch (error) { return botProofFailure(error); }
}
