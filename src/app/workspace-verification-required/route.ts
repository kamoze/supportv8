import {workspacePageFailure} from '@/lib/auth/workspace-page-failure';
export const dynamic='force-dynamic';
export function GET(){return workspacePageFailure(409);}
