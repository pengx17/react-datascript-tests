// @ts-expect-error
import datascript from 'datascript';
// @ts-expect-error
import { read } from 'edn-js';
import * as React from 'react';

function shallowEqual(objA, objB) {
  if (objA === objB) {
    return true;
  }

  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Test for A's keys different from B.
  const bHasOwnProperty = Object.prototype.hasOwnProperty.bind(objB);
  for (let i = 0; i < keysA.length; i++) {
    if (!bHasOwnProperty(keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
      return false;
    }
  }

  return true;
}

// Credits: https://github.com/gurdasnijor/react-datascript
function parseQueryAttributes(query: string) {
  const parsedQuery = read(query.trim());
  const whereKeywordIndex = parsedQuery.indexOf(Symbol.for(':where'));
  const whereClauses = parsedQuery.slice(whereKeywordIndex + 1);

  // TODO:  Get this to work with rules + not/or/or-join + expression
  // clauses...  Also figure out different parse rules for pull syntax
  return whereClauses
    .map(([_, attr]) => attr)
    .reduce((attrMap, attr) => Object.assign(attrMap, { [attr]: true }), {});
}

export const DBConnContext = React.createContext(null);

function useCompareMemo<T>(value: T) {
  const [state, setState] = React.useState(value);
  React.useEffect(() => {
    if (!shallowEqual(value, state)) {
      setState(state);
    }
  }, [value]);
  return state;
}

function useExecute(exec, onReport = exec) {
  const conn = React.useContext(DBConnContext);
  React.useEffect(() => {
    exec();
    datascript.listen(conn, onReport);
    return () => datascript.unlisten(conn);
  }, [exec, conn]);
}

export function useQuery(query: string, params?: any, rules?: string) {
  const conn = React.useContext(DBConnContext);
  const [result, setResult] = React.useState([]);
  const memorizedParams = useCompareMemo(params);
  const execQuery = React.useCallback(() => {
    let queryResult = result;
    if (query) {
      const qArgs = [query, datascript.db(conn)];
      if (memorizedParams) {
        qArgs.push(memorizedParams);
      }
      if (rules) {
        qArgs.push(rules);
      }
      queryResult = datascript.q(...qArgs);
    }
    setResult(queryResult);
  }, [query, rules, memorizedParams]);

  useExecute(execQuery, (report) => {
    const parsedQueryAttrs = query ? parseQueryAttributes(query) : {};
    const someQueryAttrChanged = report.tx_data
      .map(({ a }) => a)
      .some((a) => parsedQueryAttrs[a]);

    // Did this last transaction not contain changes to any fields referenced
    // by this query?  Skip the re-query (and corresponding component update)
    if (!query || someQueryAttrChanged) {
      execQuery();
    }
  });

  return result;
}

export function usePull(pull: string, entityIds?: any[]) {
  const conn = React.useContext(DBConnContext);
  const [result, setResult] = React.useState([]);
  const memoizedEntityIds = useCompareMemo(entityIds);
  const execQuery = React.useCallback(() => {
    if (pull) {
      setResult(
        datascript.pull_many(datascript.db(conn), pull, memoizedEntityIds)
      );
    }
  }, [pull, memoizedEntityIds]);

  useExecute(execQuery, execQuery);
  return result;
}

export function useDBConn(dbConn: (conn: any) => any) {
  const conn = React.useContext(DBConnContext);
  const [result, setResult] = React.useState([]);
  const execQuery = React.useCallback(() => {
    if (dbConn) {
      setResult(dbConn(conn));
    }
  }, []);

  useExecute(execQuery, execQuery);
  return result;
}

export function useTransact() {
  const conn = React.useContext(DBConnContext);
  return React.useCallback((data, txMsg?: string) => {
    return datascript.transact(conn, data, txMsg);
  }, []);
}
