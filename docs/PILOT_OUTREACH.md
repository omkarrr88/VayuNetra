# Pilot outreach — getting an operator to say "we would use this"

`EXPERT_OUTREACH.md` gets the system **reviewed** by an academic or regulator. This kit is a
different ask: getting someone who would actually *operate* it to say, on the record, that they
want to try it.

The distinction matters because it is the gap between a good project and a winning one. Every
finalist will have a working demo. Almost none will have a named person from a pollution control
board or a municipal environment cell saying *"send it to us for a season."* That sentence is worth
more than another model, and it is the one thing the team cannot build.

Two artefacts come out of this: a **quote** (attributable, specific, ideally critical as well as
positive) and, if it goes well, a **letter of interest**. Both go into the submission verbatim.

---

## 1 · Who to ask

Aim at the person whose Monday morning this changes — not the most senior person you can reach.
A junior zonal officer who says "this would save me two days a week" is stronger evidence than a
director who says "interesting".

| Target | Why them | How to find them |
|---|---|---|
| **Zonal / regional officer, State PCB** — DPCC (Delhi), MPCB (Pune/Mumbai), TSPCB (Hyderabad), RSPCB (Jaipur), UPPCB (Lucknow), GPCB (Ahmedabad), KSPCB (Bengaluru), TNPCB (Chennai), WBPCB (Kolkata) | They issue the notices. The worklist, the dossier and the draft notice are literally their job. | Board websites publish regional-office contacts and the officer's designation. Call the office switchboard and ask for the regional officer's PA. |
| **Municipal environment / air-quality cell** — e.g. Pune Municipal Corporation, GHMC, BMC | They own the local interventions (dust control, waste burning, construction). | Smart-City cell and Environment Department pages; several publish an Environment Status Report with the author's name. |
| **NCAP city nodal officer** | NCAP funding is the money this tool argues about. They must justify spend by source. | The NCAP portal lists a nodal officer per city. |
| **A CAQM or CPCB technical officer** (Delhi-NCR only) | GRAP is their instrument; the hindsight replay speaks directly to it. | CPCB regional directorates. |

**Practical route if cold outreach stalls:** ask a professor at a local IIT/IISc for one
introduction. A faculty referral converts far better than an email from an unknown student team,
and the same professor may also be your expert reviewer.

Two or three conversations is enough. Independence matters more than seniority, and one specific
quote beats five vague ones.

---

## 2 · The one-page brief

Send this as the body of the first email, or as a single-page PDF. It has to survive being read in
two minutes by someone who gets a hundred emails a day. Lead with their problem, not your
architecture.

> ### VayuNetra — what it puts on an officer's desk
>
> **The gap.** A CPCB station turns red. Nothing tells you *who* caused it, *where* to send an
> inspector, or what the air will do tomorrow. A 2024 CAG audit found 31% of monitored cities have
> any documented response protocol at all.
>
> **What we built.** A decision-support layer on top of the data your board already publishes.
> It runs live for ten Indian cities today, on free public infrastructure.
>
> | | |
> |---|---|
> | **Where is it worst** | Every square kilometre gets a PM2.5 estimate, not just the station locations |
> | **Who caused it** | Each cell's pollution split across traffic, industry, construction dust, burning and transport from outside — from the chemical signature of that cell, with a stated confidence |
> | **What happens next** | A 72-hour forecast with a calibrated probability of crossing Very Poor, so a warning can be issued before the air turns rather than after |
> | **Where to send someone** | A ranked worklist: contribution × residents exposed × how actionable it is × model confidence. Each item opens an evidence dossier with a satellite image of the site and the regulation it falls under, and drafts a notice for your signature |
> | **Did it work** | Every dispatched action is measured against its own cell's before/after PM2.5, weather-corrected, and exports in the format PRANA expects |
>
> **What it is not.** Not a compliance measurement — our "now" is a live station mean, not the
> 24-hour average your bulletin uses. Attribution is a model estimate with a confidence, not a
> legal finding. Notices are drafts; nothing is ever sent automatically.
>
> **What we are asking for.** Twenty minutes. We show you your own city, you tell us what is wrong
> with it and what is missing before it would be usable at your desk. We are a student team and the
> code is open source — there is nothing to buy.
>
> [name] · [phone] · vayunetra-aqi.vercel.app

---

## 3 · The twenty-minute session

Run it on **their city**, on your laptop, screen shared or in person. Set Delhi aside unless they
work in NCR — showing someone else's city is the fastest way to lose the room.

**Before you dial:** open the city once so nothing cold-starts, and check its station count. If
their city has thin coverage, say so in the first minute rather than letting them discover it.

| Minutes | What you do | What you say |
|---|---|---|
| 0–2 | Nothing. Ask first. | *"Before I show you anything — when a station in your zone goes red today, what actually happens? Who decides what to do?"* Write the answer down verbatim. This is the most valuable thing in the session and you will lose it if you demo first. |
| 2–5 | Open their city's map. Click the worst cell. | *"This is your zone, this hour. This cell's PM2.5 is mostly construction dust — here is why the model says so, and here is how confident it is. Does that match what you would expect at this location?"* |
| 5–10 | Open the worklist. Open one dossier. Show the draft notice. | *"This ranks sources by how much they contribute, how many people are downwind, and how actionable they are. This dossier has the satellite image and the regulation. This is a draft notice for your signature — we never send anything."* |
| 10–13 | Show the forecast and the probability. | *"This says there is a 70% chance this cell crosses Very Poor in 48 hours. Would a number like that change what you do today?"* |
| 13–17 | **Stop demoing. Ask.** | The three questions below. |
| 17–20 | The ask. | *"Would your office be willing to look at this on your own data for a season, with no commitment? If it is useful we would like to write that down; if it is not, we would like to know why."* |

### The three questions that produce a quotable answer

Ask these exactly, and shut up afterwards. Silence is what gets you the real answer.

1. **"What is missing before you could use this at your desk on a Monday?"**
   The gap they name is your roadmap, and their words are the quote.
2. **"Which number here would you not trust, and why?"**
   A specific criticism you then publish is *stronger* evidence of rigour than praise. It shows you
   asked a hard question and did not hide the answer.
3. **"If this existed last winter, what would you have done differently?"**
   This is the one that produces the sentence judges remember.

### Do not

- Do not ask them to endorse the accuracy. They cannot, and asking makes you look naive.
- Do not oversell. Say "model estimate", "stated confidence", "draft notice" every single time.
  Officers have been pitched dashboards before and are allergic to certainty.
- Do not skip the "what is it not" slide. Naming your own limits is what makes the rest credible.
- Do not edit their criticism out. Publish the low scores. That is the entire point.

---

## 4 · Letter of interest — template

Keep the ask small enough to be signable. An officer can say "we are willing to evaluate this"
without any procurement process; they cannot commit to deploy, so do not ask them to.

> **[Office letterhead]**
>
> To whom it may concern,
>
> I met the VayuNetra team on [date] and reviewed their air-quality decision-support system for
> [city]. The system provides per-square-kilometre source attribution, a 72-hour PM2.5 forecast
> with calibrated exceedance probabilities, and a ranked enforcement worklist with cited evidence.
>
> [One sentence in their own words about what would be useful — and, if they said it, what is
> missing.]
>
> This office would be willing to evaluate the system against our own data during the [2026-27]
> winter season, at no cost and with no commitment beyond the evaluation.
>
> [Name] · [Designation] · [Office]

---

## 5 · What to do with the result

| Outcome | What it is worth | Where it goes |
|---|---|---|
| A signed letter of interest | The strongest non-technical evidence available | Submission, README, and named on the slide |
| An attributable quote (positive or critical) | Nearly as strong, and easier to get | `docs/ADVISORY_REVIEW.md`, verbatim, with the criticism kept |
| A specific "this is missing" list | Your roadmap, and proof you asked | `docs/ADVISORY_REVIEW.md` + the roadmap section |
| No response | Still worth recording | Note how many were approached and that none replied — an honest denominator is better than silence |

Record **who was approached and when**, not only who replied. A judge who asks "did you talk to
anyone who would use this?" should get a number, not a shrug.
