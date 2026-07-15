import { createContext, useContext, useState } from 'react';

const SpeseQueueContext = createContext(null);

export function SpeseQueueProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [activeQueueId, setActiveQueueId] = useState(null);

  return (
    <SpeseQueueContext.Provider value={{ queue, setQueue, activeQueueId, setActiveQueueId }}>
      {children}
    </SpeseQueueContext.Provider>
  );
}

export function useSpeseQueue() {
  const context = useContext(SpeseQueueContext);
  if (!context) {
    throw new Error('useSpeseQueue must be used within a SpeseQueueProvider');
  }
  return context;
}
