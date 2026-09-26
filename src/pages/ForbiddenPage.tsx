import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <AppLayout>
      <div className="p-6 md:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={30} className="text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">Access Denied</h1>
          <p className="text-sm text-muted-foreground mt-2 text-pretty">
            You do not have permission to view this page. If you believe this is a mistake, contact your administrator.
          </p>
          <Button className="mt-6" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default ForbiddenPage;
