import type {Metadata} from 'next';
import './globals.css';
import './premium.css';
export const metadata:Metadata={title:'OPPO Service Academy',description:'Đào tạo và đánh giá kỹ thuật viên OPPO Việt Nam'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}
