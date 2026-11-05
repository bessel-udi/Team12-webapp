Which of your endpoints do you think will be the slowest, and why?
    | POST | `/bookings` | Create a new booking with job type, location, date/time, and chosen worker | "Team 13 needs to create a booking with job type, location, date/time, and worker chosen, in order to schedule a fundi to fix hospital equipment or infrastructure." |
    We think this will be the slowest one since the process involves writing data to our database to create the actual bookings. 

Which do you think will produce the most errors, and why?
    | POST | `/bookings` | Create a new booking with job type, location, date/time, and chosen worker | "Team 13 needs to create a booking with job type, location, date/time, and worker chosen, in order to schedule a fundi to fix hospital equipment or infrastructure." |
    We think this one we also be the one that has the most errors since it has the most steps hence more areas for things to go wrong.



Slowest on average?
    GET /provider-inventory/:id: 1,447.6 ms. Every other route averages under 5 ms.

Slow worst case?
    The same route: 15,646.8 ms. That matches 3 attempts × your 5,000 ms timeout plus the 200 ms and 400 ms retry delays, which is 15,600 ms. So that request waited through a timeout on every attempt.

Fails most often?
    GET /workers/ and GET /workers/:id: 97 of 97 requests were 5xx. That’s the stopped MySQL. The inventory route failed once in 29.

401s: mistake or probing?
    Mistakes, not probing. 29 of the 260 requests (11%) returned 401, and every one has caller: "none". That matches the no-key requests my own traffic.js sends on purpose, about 1 in 9 of its mix. No unknown key labels appeared in the log, and the 401s came in step with my own script runs, not at other times.

Is the error rate healthy?
    37.7% is not healthy. But 97 of the 98 server errors come from /workers and the database. Without them, the rate would be 1 in 163, about 0.6%.


Sample log lines:
    {"time":"2026-11-05T00:26:09.937Z","method":"GET","path":"/","status":200,"ms":1.1,"caller":"key-28ad13"}
    {"time":"2026-11-05T00:26:32.951Z","method":"GET","path":"/provider-inventory/15","status":200,"ms":6916.5,"caller":"none"}
    {"time":"2026-11-05T00:26:08.856Z","method":"GET","path":"/workers","status":401,"ms":4.3,"caller":"none"}
    {"time":"2026-11-05T00:26:09.221Z","method":"GET","path":"/workers","status":401,"ms":0.6,"caller":"none"}


/stats output
    {
    "startedAt":  "2026-11-05T00:24:24.028Z",
    "uptimeSeconds":  1598,
    "total":  262,
    "clientErrors":  110,
    "serverErrors":  98,
    "errorRatePercent":  37.4,
    "avgMs":  162,
    "routes":  {
                   "GET (no route)":  {
                                          "count":  110,
                                          "clientErrors":  110,
                                          "serverErrors":  0,
                                          "avgMs":  0.6,
                                          "maxMs":  4.3
                                      },
                   "GET /workers/":  {
                                         "count":  66,
                                         "clientErrors":  0,
                                         "serverErrors":  66,
                                         "avgMs":  4.4,
                                         "maxMs":  37.7
                                     },
                   "GET /workers/:id":  {
                                            "count":  31,
                                            "clientErrors":  0,
                                            "serverErrors":  31,
                                            "avgMs":  3,
                                            "maxMs":  6.1
                                        },
                   "GET /":  {
                                 "count":  25,
                                 "clientErrors":  0,
                                 "serverErrors":  0,
                                 "avgMs":  0.6,
                                 "maxMs":  1.1
                             },
                   "GET /provider-inventory/:id":  {
                                                       "count":  29,
                                                       "clientErrors":  0,
                                                       "serverErrors":  1,
                                                       "avgMs":  1447.6,
                                                       "maxMs":  15646.8
                                                   },
                   "GET /stats":  {
                                      "count":  1,
                                      "clientErrors":  0,
                                      "serverErrors":  0,
                                      "avgMs":  0.9,
                                      "maxMs":  0.9
                                  }
               }
}
