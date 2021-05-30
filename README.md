# Discord verifier server
- runs on port 4000 of the server
- to run use `yarn run run`

# Required
- Create a `token.ts` file that exports `token,guild_id,verified_guild_id, website, sender_email`

# Libraries used
- See package.json

# Architecture design

```
|-------------| send zid & discord tag  |-----------------|   Update discord tag role  |----------------|
|             |------------------------>|                 | -------------------------->|                |
|Google Forms |                         | Verifier server |                            | Discord        |
|             |                         |                 |                            |                |
|-------------|                         |-----------------|                            |----------------|
                                            |          ^
                                Send        |          |   Email link notifies 
                                verification|          |   verifier server
                                email       |          |   that zid has verified
                                            |          |
                                            |          |
                                            v          |
                                        |-------------------|
                                        |                   |
                                        | zid email server  |
                                        |                   |
                                        |-------------------|
```
