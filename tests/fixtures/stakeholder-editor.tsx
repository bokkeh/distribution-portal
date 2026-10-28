import { createRoot } from 'react-dom/client'
import { OrderOperationsEditor } from '../../components/orders/OrderOperationsEditor'
const data = (window as unknown as { fixture: { initial: import('../../lib/orders/operations').OperationValues } }).fixture
createRoot(document.getElementById('root')!).render(<><a href="/other">Other page</a><OrderOperationsEditor orderId="10000000-0000-4000-8000-000000000001" initial={data.initial} stripeManaged={false} sample={false} drivers={[]}/></>)
