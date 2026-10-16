import { boardPins, getBoard } from "./boards.js";
import { getPin } from "./pins.js";
import { searchAll, searchPins, searchScoped } from "./search.js";
import type { SearchScope } from "./search.js";
import { getUser, userPins } from "./users.js";
import {
  createEmptySession,
  cookieHeader,
  setSessionCookies,
  hasCredentials,
} from "../Vault/session.js";
import { configureTransport } from "../Client/client.js";
import type { Board } from "../Shapes/boards.js";
import type { Page, PagingOptions, SessionState } from "../Shapes/common.js";
import type { Pin } from "../Shapes/pins.js";
import type { UserProfile } from "../Shapes/users.js";
import type { SaveSession } from "../Vault/index.js";

export interface PintoOptions {
  session?: SessionState;
  saveSession?: SaveSession;

  fetch?: typeof fetch;
}

export interface SearchOptions extends PagingOptions {
  scope?: SearchScope;
}

export function createPinto(config?: PintoOptions) {
  const session =
    config && config.session ? config.session : createEmptySession();
  configureTransport(
    session,
    config !== undefined ? { fetchImpl: config.fetch } : undefined,
  );
  async function save(): Promise<void> {
    if (config && config.saveSession) {
      await config.saveSession(session);
    }
  }

  async function onePin(input: string): Promise<Pin> {
    return getPin(session, input);
  }

  async function oneUser(input: string): Promise<UserProfile> {
    return getUser(session, input);
  }

  async function oneBoard(input: string): Promise<Board> {
    return getBoard(session, input);
  }

  async function findPins(
    query: string,
    options?: PagingOptions,
  ): Promise<Page<Pin>> {
    return searchPins(session, save, query, options);
  }

  async function findScoped(
    query: string,
    options?: SearchOptions,
  ): Promise<Page<Pin>> {
    const scope = options && options.scope ? options.scope : "pins";
    return searchScoped(session, save, query, scope, options);
  }

  function iterateSearch(
    query: string,
    scope?: SearchScope,
    pageSize?: number,
  ): AsyncGenerator<Pin, void, undefined> {
    return searchAll(session, save, query, scope, pageSize);
  }

  async function pinsFromBoard(
    input: string,
    options?: PagingOptions,
  ): Promise<Page<Pin>> {
    return boardPins(session, input, options);
  }

  async function pinsFromUser(
    input: string,
    options?: PagingOptions,
  ): Promise<Page<Pin>> {
    return userPins(session, input, options);
  }

  function setCookies(input: string | Record<string, string>): Promise<void> {
    setSessionCookies(session, input);
    return save();
  }

  function exportCookies(): string {
    return cookieHeader(session);
  }

  function isAuthenticated(): boolean {
    return hasCredentials(session);
  }

  return {
    session,
    getPin: onePin,
    getUser: oneUser,
    getBoard: oneBoard,
    searchPins: findPins,
    search: findScoped,
    searchAll: iterateSearch,
    boardPins: pinsFromBoard,
    userPins: pinsFromUser,
    setCookies,
    exportCookies,
    isAuthenticated,
  };
}

export type Pinto = ReturnType<typeof createPinto>;
export type { SearchScope };
