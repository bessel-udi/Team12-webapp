# Versioning notes (Week 13)

## 1. The change

`GET /workers` now returns `{ "data": [...], "count": N }` in v2, instead of a bare list `[...]` in v1. Nothing else changes.

## 2. Why it is worth a break

Wrapping the list lets us add paging later (page, limit, total) without breaking callers again. A bare list has nowhere to put that information.

## 3. Prediction: which line in my partner's code will fail

<Ask Team 13 which file and line receive the response of GET /workers. Write it here, for example:
"In <their file>, line <n>: `<the code>` runs `.map` / a loop on the response body, which is now an object, not an array.">

## Who still uses v1 (Part F)

<Run: curl.exe -s -H "X-API-Key: $env:KEY" "$env:API/stats"
Write the call counts for GET /v1/workers, GET /workers and GET /v2/workers, and which caller labels (key-xxxxxx) appear on each.
Is your partner still on v1? Could you switch v1 off today without breaking anyone?>

## Receiving a notice (Part E)

<One or two sentences, in your own words: how did it feel to receive Team 11's notice? Did it say what changes, why, an example, and a date? What was missing?>

## Reflection (150 to 250 words, in your own words)

<Answer all four:
1. What was it like to receive a breaking change on short notice? How did you find out, and what did you do first?
2. What did your partner's notice do well, and what was missing?
3. Read your own notice again as your partner. What would you change?
4. As the API owner next time, what is one thing you would do differently?
Be specific: "I found out when my page showed saved data and I didn't know whether it was my bug or theirs" beats "it was annoying".>
