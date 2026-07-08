export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

export interface Subject {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface Topic {
  id: string;
  userId: string;
  subjectId: string;
  name: string;
  createdAt: Date;
}

export interface StudySession {
  id: string;
  userId: string;
  topicId: string;
  subjectId: string;
  studiedAt: Date;
  reviewDate: Date;
  notes?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    type: 'review';
    session: StudySession;
    topicName: string;
    subjectName: string;
    subjectColor: string;
  };
}

export type ThemeMode = 'dark' | 'light' | 'claude' | 'teams' | 'bruma' | 'kindle' | 'curatino' | 'themis' | 'themisDark';
