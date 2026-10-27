import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default function RetiredPreview(){redirect('/auth/sign-in?return_to=%2F')}
