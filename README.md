# Idea of autogenerated Test Cases For Web

To have autogenerated test cases for web apps . First things is to build a Node Graph that can precisely capture the full flow
of application . Things that we need are State of each node ,on which action node is modified . Action can be any of user defined actions .For example mouse clicks,keyboard etc .

We tried to have a proof of concept for building this Node Graph .

## Problem Statement :
If we have nodes x1,x2,x3.......xN .  Nodes can be mutual independent or  node may be conditionaly dependent on other node or group of nodes .
We have to find these relations which groups are dependent on each other or nodes which are creating other nodes or removing other nodes.

Lets consider only user action is Click in that case what are scenarios that we may have to consider .

Node might be clicked now and it may have delayed response .
Node click might change state of other nodes ,remove them or disable actions on them etc .But we want to explore action on those nodes as well .

Exploring state and transitions for nodes which are newly added .

## Solution:

This is essentially a problem of state machine .Which has pre Events ,and then a action on it either creates nodes ,remove nodes or does a change in current attributes of nodes etc .
To find action and mutuation we have built a forward backward learning method .

Backward Pass - start with the last action and mutations .wait for maximum time,between the action and mutation,use some approx otherwise max delay.Backward pass at first will remove all mutations from end.leaving only few possible mutation for front candidates.
Forward Pass- is a confirmation loop that muatation connected to backward pass are correct.


## Running Test example:

  Install all code dependencies.
        
        npm install

### 1. Run server :

        node simple_server.js
    
### 2. Run chorme in debug mode on port 9222

        google-chrome --remote-debugging-port=9222
    
### 3. Get UID of chrome session .

        http://127.0.0.1:9222/json/version

        {
       "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/browser/9c80d6fc-b81e-456b-91fb-abd665a9113b"
        }
    session id is 9c80d6fc-b81e-456b-91fb-abd665a9113b.

    Replace that in app_run.js
    let uid = '9c80d6fc-b81e-456b-91fb-abd665a9113b'; 

### 4. Run app_run.js
    
        node  app_run.js

On run automatic exploring of click actions will be observed .For test action mutaion output will be dumped in "out" directory .which shows on which node path action taken and what is mutation w.r.t that .







