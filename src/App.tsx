import { Rail } from './components/Rail';
import { SyncBanner } from './components/SyncBanner';
import { Toast } from './components/Toast';
import { useRoute } from './nav';
import { BilletsView } from './views/billets/BilletsView';
import { GrantsView } from './views/grants/GrantsView';
import { HistoryView } from './views/history/HistoryView';
import { OverviewView } from './views/overview/OverviewView';
import { PeopleView } from './views/people/PeopleView';
import { PersonView } from './views/person/PersonView';
import { SectionView } from './views/section/SectionView';
import { SimulatorView } from './views/simulator/SimulatorView';

export default function App() {
  const { route, id, query } = useRoute();
  return (
    <div dir="rtl" className="flex h-full min-w-[1024px] overflow-hidden bg-bg">
      <Rail current={route} />
      <main className="flex min-w-0 flex-1 flex-col">
        <SyncBanner />
        {route === 'people' && <PeopleView viewCode={query.get('view')} />}
        {route === 'person' && <PersonView id={id} />}
        {route === 'section' && <SectionView id={id} />}
        {route === 'billets' && <BilletsView key={query.get('q') ?? ''} initialQuery={query.get('q') ?? ''} />}
        {route === 'grants' && <GrantsView />}
        {route === 'overview' && <OverviewView />}
        {route === 'history' && <HistoryView />}
        {route === 'simulator' && <SimulatorView />}
      </main>
      <Toast />
    </div>
  );
}
