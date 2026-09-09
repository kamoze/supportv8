import {handleVoiceDomainRequest,voiceDomainAuthenticatorFromEnv} from '@/lib/voice/voice-domain';
import {supportVoiceStore} from '@/lib/voice/support-voice-store';

export async function POST(request:Request){
  return handleVoiceDomainRequest(request,{authenticate:voiceDomainAuthenticatorFromEnv(),store:supportVoiceStore});
}
