import { useExtension } from '@/context/ExtensionContext';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Coffee, AlertTriangle, Power, Unplug } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

export const ExtensionStatusIndicator = () => {
  const { isExtensionInstalled, extensionStatus } = useExtension();

  if (!isExtensionInstalled) {
    return (
      <Card className="bg-destructive/10 border-destructive/50">
        <CardContent className="p-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Extension Not Installed</p>
            <p className="text-sm text-destructive/80">Please install the Coogi Chrome Extension to find contacts.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!extensionStatus) {
    return <Skeleton className="h-16 w-full" />;
  }

  const getStatusContent = () => {
    switch (extensionStatus.status) {
      case 'active':
        return { icon: <Zap className="h-5 w-5 text-primary animate-pulse" />, title: 'Active' };
      case 'cooldown':
        return { icon: <Coffee className="h-5 w-5 text-muted-foreground" />, title: 'On Cooldown' };
      case 'idle':
        return { icon: <Power className="h-5 w-5 text-green-500" />, title: 'Idle' };
      case 'disconnected':
        return { icon: <Unplug className="h-5 w-5 text-destructive" />, title: 'Disconnected' };
      default:
        return { icon: <AlertTriangle className="h-5 w-5 text-destructive" />, title: 'Error' };
    }
  };

  const { icon, title } = getStatusContent();

  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        {icon}
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{extensionStatus.message}</p>
        </div>
      </CardContent>
    </Card>
  );
};