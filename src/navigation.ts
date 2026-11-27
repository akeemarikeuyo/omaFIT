import { NavigatorScreenParams } from '@react-navigation/native';
import { SessionId } from './data/plan';

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Session: { sessionId: SessionId; short?: boolean };
  Exercise: { sessionId: SessionId; exerciseId: string };
  Walk: undefined;
  LogDetail: { logId: string };
  Setup: undefined;
  PlanBuilder: undefined;
};

export type TabParamList = {
  Today: undefined;
  Progress: undefined;
  Review: undefined;
  Coach: undefined;
  Settings: undefined;
};
