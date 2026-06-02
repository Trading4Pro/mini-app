# --- build stage: compile the fat jar with Maven ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
# Resolve dependencies first so they cache across source-only changes.
COPY pom.xml .
RUN mvn -q -e -B dependency:go-offline
COPY src ./src
RUN mvn -q -e -B clean package -DskipTests

# --- runtime stage: just a JRE + the jar ---
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/spamwatch-bot.jar /app/spamwatch-bot.jar
# config.json is mounted at runtime (see docker-compose.yml); BOT_TOKEN comes from env.
ENTRYPOINT ["java", "-jar", "/app/spamwatch-bot.jar", "/app/config.json"]
