import { Notice } from './ui';
import type { ConsultationResponse } from '../types';
export default function LiveCall(_props: { session: ConsultationResponse }) {
  return <Notice message="Live calls are available in the Android and iOS development builds. Use the OraVisionAI website for calls in your browser." />;
}
