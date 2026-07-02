export interface ResolvedActor {
  name: string;
  photoURL: string;
}

export interface IUserProfileLookupService {
  resolveActor(uid: string): Promise<ResolvedActor>;
}
