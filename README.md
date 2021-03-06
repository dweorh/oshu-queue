# oshu-queue

It is a lightweight queue manager based on [GunJS](https://gun.eco).
oshu-queue was developed as a part of the [Oshu-gun](https://www.oshu-gun.com) project.

## Configuration

The basic configuration is set in _.env_ file.

- HOST_ADDRESS - address of the GunJS Server
- ORCHESTRATOR_PAIR - SEA.pair() of the orchestrator
- PUBLISHER_PAIR - SEA.pair() of the publisher
- SUBSCRIBER_PAIR - SEA.pair() of the subscriber
- ORCHESTRATOR_ID - value of ORCHESTRATOR_PAIR.pub
- AUTH_PUBLISHER - used by Orchestrator to authorize Publishers
- AUTH_SUBSCRIBER - used by orchestrator to authorize Subscribers
- AUTH_KEY - used by Publishers and Subscribers for authorization
- USE_MODULES - set 'true' to use 'gunjs' installed via npm
- VERBOSE - used for development

Because each player can be set on a separate machine, not all keys must be always set.

Eg. ORCHESTRATOR_ID is required only for PUBLISHER and SUBSCRIBER.
If the 'pair' value is not set, oshu-queue will create a new instance of the player when starting.

## Players

There are 3-4 players in the queue system.

### GunJS server

It can be any GunJS instance.
For test/dev purposes, you can run

```bash
node ./dev/server.js
```

### orhestrator.js

It is the core of queue communication.
The orchestrator is responsible for gathering publishers' messages, forwarding them as jobs to subscribers, and sending back results from subscribers to publishers.
Content of the messages and jobs is encrypted by SEA.encrypt().
There are two main types of messages: OshuQueueMessage and OshuJobMessage.

### publisher.js

It is a player who prepares tasks, sends them to the orchestrator, and listens for results.

### subscriber.js

Subscriber, aka worker, does the job for publishers. Every subscriber has its type, which is 'generic' by default, and will handle only an OshuQueueMessage with such type only.

Eg. if the Publisher will send a message of type 'common', and there will be no Subscriber of that type, such job will never be done, even though there will be many other Subscribers.

## Authorization

Authorization is optional, but gunjs is a distributed database, so to avoid unknown players, it's recommended to use at least a basic authorization.

In queue_common.js there are two classes: OshuQueueAuthEnvelope and OshuQueueBasicAuth.

OshuQueueAuthEnvelope is used to exchange auth information between Orchestrator and Publisher/Subscriber.

OshuQueueBasicAuth is a simple auth class used by Orchestrator to check if provided key equals the expected one.

## Example

Set GunJS server in the _.env_

```.env
HOST_ADDRESS=http://localhost:8765/gun
```

Next, start the orchestrator

```bash
node ./dev/orchestrator.js
```

That will output like this:
___
_Add this to your .env file_

_ORCHESTRATOR_PAIR='{"pub":"-dlC5pQ8F5AkewQKygNNPACTZmoyEHKv97Z2WZ5-npE.ocqffkfPQiOE_ZVpauGsN8kFHnYigHHmeJ6q7M64aok","priv":"jrn-Fx63ijEKBxTOB6yE4R_3EtkdqgoVAUy6zL_iVec","epub":"FBkXzBr-mnshW_KqNg2fC1kKEYvcFCcIacqXBYTzHww.JoMQxktfuIZgnjrFwJ0hfHhQvXfnghVqxsL48K1dbZ0","epriv":"NNeTOH0ZtPYZhtPLrkaKHRgfE9Tsp0SHv3SdVpiuW5w"}'_
___
Add it to the _.env_ file of the Orchestrator.
Next
Copy the 'pub' part to _.env_ for Publisher and Subscriber

```.env
ORCHESTRATOR_ID=-dlC5pQ8F5AkewQKygNNPACTZmoyEHKv97Z2WZ5-npE.ocqffkfPQiOE_ZVpauGsN8kFHnYigHHmeJ6q7M64aok
```

And you start dev examples of both of them

```bash
node ./dev/publisher.js
```

```bash
node ./dev/subscriber.js
```

Enjoy :-)

Btw. GunJS in ./src/libs is just a snapshot of the library as known issues are better than unknown fixes ;)

It is an early stage of the project so there might be some issues. Report them in the project's GitHub, please.
