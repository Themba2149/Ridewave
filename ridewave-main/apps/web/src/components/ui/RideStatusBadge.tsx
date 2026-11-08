import { STATUS_LABEL, STATUS_TONE, type RideStatus } from '../../lib/ride-status';
import { Badge } from './Badge';

export const RideStatusBadge = ({ status }: { status: RideStatus }) => <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
