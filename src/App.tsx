import { Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import content from 'virtual:content';
import { eventPath, findEvent } from './content/events';
import { MainView } from './MainView';

const { events } = content;

/** `/event/<id>`: that event, or the first event with a notice when the id is unknown. */
function EventRoute() {
  const { eventId } = useParams();
  const { search } = useLocation();
  const event = findEvent(events, eventId);
  if (!event && events.length > 0) {
    return <Navigate replace to={`${eventPath(events[0].id)}${search}`} state={{ unknownEvent: true }} />;
  }
  return <MainView event={event} />;
}

/** Any other address goes to the first event, keeping the `map` and `lang` parameters. */
function FirstEventRoute() {
  const { search } = useLocation();
  if (events.length === 0) return <MainView />;
  return <Navigate replace to={`${eventPath(events[0].id)}${search}`} />;
}

export function App() {
  return (
    <Routes>
      <Route path="/event/:eventId" element={<EventRoute />} />
      <Route path="*" element={<FirstEventRoute />} />
    </Routes>
  );
}
