import { createSupportTaskWorkRequestHandler } from '@/lib/tasksv8/request';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {return createSupportTaskWorkRequestHandler()(request,(await context.params).id);}

export const GET=POST;
