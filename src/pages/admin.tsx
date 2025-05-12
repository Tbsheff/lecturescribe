import { ContentLayout } from "@/components/admin-panel/content-layout";
import AdminPanelLayout from "@/components/admin-panel/admin-panel-layout";

// Wrapper component to provide the admin panel layout
export function AdminPageLayout({ children }: { children: React.ReactNode }) {
    return <AdminPanelLayout>{children}</AdminPanelLayout>;
}

// Admin Dashboard page
export default function AdminPage() {
    return (
        <AdminPageLayout>
            <ContentLayout title="Admin Dashboard">
                <div className="p-4 bg-white dark:bg-zinc-800 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Welcome to the Admin Panel</h2>
                    <p>This is your new admin dashboard powered by the shadcn sidebar component.</p>
                </div>
            </ContentLayout>
        </AdminPageLayout>
    );
} 