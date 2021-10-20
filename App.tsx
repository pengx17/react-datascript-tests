import * as React from 'react';
// @ts-expect-error
import * as datascript from 'datascript';
import {
  useQuery,
  usePull,
  useTransact,
  DBConnContext,
  useDBConn,
} from './use-datascript';

/**
 * Define a schema for a graph of users (with the names declared to be
 * unique which allows better performance, along with being able to easily lookup
 * an entity by this unique identifier)
 *
 * The users are connected by the 'follows' attribute (which is defined as a
 * reference type, with a cardinality of 'many' since someone can follow more
 * than one person.)
 */
const twitterUserSchema = {
  name: {
    ':db/cardinality': ':db.cardinality/one',
    ':db/unique': ':db.unique/identity',
  },
  follows: {
    ':db/cardinality': ':db.cardinality/many',
    ':db/valueType': ':db.type/ref',
  },
};

const init = () => {
  /**
   * Create connection to db (that's been instantiated with the schema above.)
   */
  const conn = datascript.create_conn(twitterUserSchema);

  /**
   * Define some seed data; including some `follower` references (that make
   * use of a temporary id to point to other entities within the array.)
   */
  const datoms = [
    {
      ':db/id': -1,
      name: 'John',
      follows: -3,
    },
    {
      ':db/id': -2,
      name: 'David',
      follows: [-3, -1],
    },
    {
      ':db/id': -3,
      name: 'Jane',
    },
  ];

  /**
   * Transact in the data, to be stored and indexed by datascript for performant
   * querying.
   */
  datascript.transact(conn, datoms);
  return conn;
};

const AllUsers = () => {
  const result = useQuery(
    `
[:find ?user
  :where
  [?u "name"]
  [?u "name" ?user]]`
  );
  return (
    <div>
      <h3> All users (every node in the graph)</h3>
      <ul>
        {result.map((user, id) => (
          <li key={id}>{`${JSON.stringify(user)}`}</li>
        ))}
      </ul>
    </div>
  );
};

const AllUsersFromIndex = () => {
  const result = useDBConn((conn) =>
    datascript.datoms(datascript.db(conn), ':aevt', 'name')
  );
  return (
    <div>
      <h3> All users (every node in the graph)</h3>
      <ul>
        {result.map((user, id) => (
          <li key={id}>{`${JSON.stringify(user)}`}</li>
        ))}
      </ul>
    </div>
  );
};

const AllUserEdgesComponent = () => {
  const result = useQuery(
    `
     [:find ?user1 ?user2
      :in $ %
      :where (follows ?u1 ?u2)
              [?u1 "name" ?user1]
              [?u2 "name" ?user2]]`,
    null,
    `
    [[(follows ?e1 ?e2)
       [?e1 "follows" ?e2]]
      [(follows ?e1 ?e2)
       [?e1 "follows" ?t]
       (follows ?t ?e2)]]`
  );
  return (
    <div>
      <h3> All follower pairs (every edge in the graph)</h3>
      <ul>
        {result.map(([user1, user2]) => (
          <li key={user1 + user2}>{`${user1} follows ${user2}`}</li>
        ))}
      </ul>
    </div>
  );
};

const FollowerTreeComponent = () => {
  const result = usePull('["name", {"_follows" ...}]', [['name', 'Jane']]);
  const transact = useTransact();
  return (
    <div>
      <h3>A tree of all followers under Jane </h3>
      <button
        onClick={() =>
          transact([
            {
              ':db/id': -1,
              name: `Follower of Jane ${new Date().getTime()}`,
              follows: ['name', 'Jane'],
            },
          ])
        }
      >
        Add follower
      </button>
      <code>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </code>
    </div>
  );
};

function App() {
  const [conn] = React.useState(init());
  return (
    <DBConnContext.Provider value={conn}>
      <AllUsers />
      <AllUsersFromIndex />
      <AllUserEdgesComponent />
      <FollowerTreeComponent />
    </DBConnContext.Provider>
  );
}

export default App;
