<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

```
backend
├─ .prettierrc
├─ docker-compose.yml
├─ Dockerfile
├─ eslint.config.mjs
├─ nest-cli.json
├─ package-lock.json
├─ package.json
├─ README.md
├─ src
│  ├─ app.controller.spec.ts
│  ├─ app.controller.ts
│  ├─ app.module.ts
│  ├─ app.service.ts
│  ├─ common
│  │  └─ enum
│  │     └─ role.enum.ts
│  ├─ config
│  │  └─ configuration.ts
│  ├─ main.ts
│  ├─ modules
│  │  ├─ auth
│  │  │  ├─ auth.controller.ts
│  │  │  ├─ auth.module.ts
│  │  │  ├─ auth.service.ts
│  │  │  ├─ decorators
│  │  │  │  ├─ current-user.decorator.ts
│  │  │  │  └─ roles.decorators.ts
│  │  │  ├─ dto
│  │  │  │  ├─ login.dto.ts
│  │  │  │  └─ register.dto.ts
│  │  │  ├─ guards
│  │  │  │  ├─ jwt-auth.guard.ts
│  │  │  │  └─ role.guard.ts
│  │  │  ├─ schemas
│  │  │  │  ├─ refresh-token.schema.ts
│  │  │  │  └─ user.schema.ts
│  │  │  └─ strategies
│  │  │     ├─ jwt-refresh.strategy.ts
│  │  │     └─ jwt.strategy.ts
│  │  ├─ database
│  │  │  ├─ database.module.ts
│  │  │  └─ database.service.ts
│  │  ├─ packages
│  │  │  ├─ packages.controller.ts
│  │  │  ├─ packages.module.ts
│  │  │  └─ packages.service.ts
│  │  └─ users
│  │     ├─ users.controller.ts
│  │     ├─ users.module.ts
│  │     └─ users.service.ts
│  └─ shared
├─ test
│  ├─ app.e2e-spec.ts
│  └─ jest-e2e.json
├─ tsconfig.build.json
└─ tsconfig.json

```


---

## 1. The Tech Stack

* **FastAPI:** This turns the script into a web service. Other applications (like a mobile app for drivers or a manager's dashboard) can send data to this script via a URL (`/solve`) and get the results back instantly.
* **Google OR-Tools:** This is the heavy-lifting math intelligence engine. Instead of trying to guess billions of different route combinations, Google's optimization algorithms find the best answer in seconds.

---

## 2. The Golden Rules (Constraints)

The solver doesn't just look for the shortest path; it has to follow strict business rules programmed into the code:

* **Weight Limits (Capacity):** Every vehicle has a maximum weight limit. The code adds up the package weights and ensures no truck is overloaded.
* **Time Windows:** Packages might have priority delivery times (e.g., must arrive between 9:00 AM and 11:00 AM). Also, drivers have working shifts (e.g., 8:00 AM to 5:00 PM). The solver ensures nobody works overtime and no package is late.
* **Workload Balancing (Minimax):** Instead of giving all the deliveries to one fast driver while others sit idle, the code tries to distribute the driving time evenly among all active drivers.
* **Minimum Stops:** It forces the system to give every driver at least a few packages (if there are enough to go around), preventing drivers from being left with 0 tasks.
* **Drop Penalties (Disjunctions):** If a package is literally impossible to deliver (e.g., it weighs 500kg but your biggest truck only holds 200kg), the solver won't crash. It will "drop" that package from the schedule, pay a huge imaginary penalty score, and route everything else normally.

---

## 3. The Mathematics Behind It

Google OR-Tools converts this real-world problem into graph theory and mathematical equations. Here are the core concepts explained simply:

### The Cost Function (What we are minimizing)

The solver works by trying to get the lowest possible score on an imaginary "Cost" scoreboard.

$$\text{Total Cost} = \text{Travel Time} + \text{Workload Imbalance Penalty} + \text{Dropped Package Penalty}$$

* **Travel Time:** The total seconds spent driving on the road.
* **Workload Imbalance Penalty (Global Span Coefficient):** This relates to the line `time_dim.SetGlobalSpanCostCoefficient(100)`. If Driver A's route takes 8 hours and Driver B's route takes 2 hours, the difference is 6 hours. The math looks like this:

$$\text{Imbalance Penalty} = (\text{Max Route Duration} - \text{Min Route Duration}) \times 100$$



Because this penalty is high, the solver will shift stops from Driver A to Driver B to make the routes more equal.
* **Dropped Package Penalty:** If a package cannot be delivered, a massive penalty ($1,000,000$) is added to the score. The algorithm will do everything in its power to avoid this penalty.

### Why is everything multiplied by 10? (`WEIGHT_MULTIPLIER = 10`)

Computers solve these specific types of routing math much faster and more reliably using whole integers rather than decimals. If a package weighs $2.5 \text{ kg}$, the code multiplies it by $10$ to make it $25$. At the very end of the script, it divides by $10$ to turn it back into a decimal ($2.5$) before showing you the answer.

---

## 4. Step-by-Step Code Flow

1. **Data Input (`solve` function):** The code receives the travel durations between all points, vehicle details, and package info. It checks for basic errors (e.g., making sure you didn't forget to submit vehicles).
2. **Setting up the Grid:** It initializes the Google OR-Tools manager, setting the starting point (Depot) to index `0`.
3. **Building Dimensions:** It builds tracks for cumulative data. For every step a driver takes, OR-Tools calculates a **CumulVar** (Cumulative Variable) for time, weight capacity, and stop counts.
4. **The Search Strategy:** It uses a mathematical approach called **Guided Local Search**. Think of it like a smart GPS that finds a good route first, and then tweaks individual turns over and over again to see if it can shave off a few minutes.
5. **Data Output (`Extract solution`):** Once the math engine finishes, the code gathers the results into a neat timeline showing exactly which driver goes where, what time they will arrive at each stop, and which packages (if any) couldn't fit into the schedule.

---
This sequence diagram outlines a real-time delivery and dispatch ecosystem (named **Chonhchoun**). It uses a mix of **HTTP Requests** (for permanent actions like saving data) and **MQTT Messages** (for instant, real-time updates like location tracking).

To understand how they talk to each other, think of the system having two communication styles:

1. **The Request-Response Style (NestJS API):** Like ordering food at a restaurant. You ask for something, wait, and get an answer.
2. **The Post Office Style (Mosquitto MQTT Broker):** Like subscribing to a magazine. You subscribe to a specific topic, and whenever a new issue (or message) is published, the post office delivers it to you instantly.

---

## 👥 Meet the Characters (The Participants)

* **Flutter App (Admin/Agency):** The boss who triggers the deliveries and watches the big dashboard.
* **Flutter App (Driver):** The delivery person moving on the road.
* **Flutter App (Customer):** The person waiting at home, staring at a map.
* **NestJS API:** The brain of the operation. It handles heavy math, talks to databases, and makes official decisions.
* **Mosquitto Broker (MQTT):** The instant megaphone. It doesn't process data; it just takes a message from one person and instantly flashes it to everyone else listening.
* **MongoDB & Redis:** The long-term memory (Mongo) and short-term quick memory (Redis).

---

## ✉️ How MQTT Works Here (The Simple Version)

MQTT uses **Topics** (which look like website URLs) to route messages. If you **Publish** to a topic, anyone **Subscribed** to that topic gets the message instantly.

In this system, there are three main MQTT topics:

1. `chonhchoun/deliveries/{deliveryId}/status` — *“What is the status of this delivery?”*
2. `chonhchoun/drivers/{driverId}/status` — *“Is this driver busy or free?”*
3. `chonhchoun/drivers/{driverId}/location` — *“Where exactly is this driver right now?”*

> 💡 **What does `[retain=true]` mean in the diagram?** > It means the Mosquitto Broker will **save** the last message sent on that topic. When a driver or customer connects late, they don't have to wait for a new message; MQTT hands them the saved message immediately so their app loads instantly.

---

## 🔄 Step-by-Step: How They Talk to Each Other

### Phase 1: The Setup (Admin ➔ API)

The Admin app asks the **NestJS API** to plan the routes. The API calculates the best paths using a specialized AI solver, saves everything to **MongoDB**, and then tells the **MQTT Broker**: *“Hey, Delivery #123 is now PLANNED, and Driver Bob is ON_DELIVERY.”* Because `retain=true` is used, MQTT holds onto this status.

### Phase 2 & 3: The Connection (Driver & Customer ➔ MQTT)

Both the Driver and the Customer open their apps. Instead of constantly bothering the NestJS API asking *"Is there an update yet?"*, they simply connect to the **MQTT Broker**:

* The **Driver** subscribes to their delivery status. MQTT immediately hands them the saved "PLANNED" message, and the driver instantly sees their route on the map.
* The **Customer** subscribes to the delivery status *and* the driver’s location.

### Phase 4: Live Tracking (Driver ➔ MQTT ➔ Customer & API)

This is where MQTT shines. Every 5 seconds, the **Driver’s app** sends a tiny packet of GPS coordinates to the topic `chonhchoun/drivers/{driverId}/location`.

* The **MQTT Broker** acts like a mirror and reflects this coordinate to the **Customer's app** instantly. The customer sees the delivery pin move smoothly across Google Maps.
* The **NestJS API** also listens to this topic, grabbing the location to temporarily cache it in **Redis** so the system always knows where everyone is.

### Phase 5 & 6: Completion (Driver ➔ API ➔ MQTT ➔ Everyone)

When a driver drops off a package:

1. The **Driver** tells the **NestJS API** (via an HTTP PATCH request) "I am done!".
2. The **API** updates the database to mark the job as "COMPLETED" and frees up the driver's status to "AVAILABLE".
3. The **API** shouts to the **MQTT Broker**: *"Delivery #123 is COMPLETED!"*
4. The **MQTT Broker** broadcasts this to the Customer (who sees a "Package Delivered" screen), the Driver (who goes back to the home screen), and the Admin dashboard.

### Phase 7: The Emergency Brake (Admin ➔ API ➔ MQTT)

If an Admin cancels a delivery, they tell the **API**. The API resets the packages in the database and tells **MQTT**: *"This is CANCELLED."* MQTT passes the bad news to the Driver and Customer apps immediately, stopping the driver from driving any further.