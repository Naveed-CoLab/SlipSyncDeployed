FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app

# Copy everything and build the Spring Boot JAR.
# The Clerk Java SDK JAR will be provided in the local libs/ folder (see pom.xml).
COPY . .
RUN chmod +x mvnw && ./mvnw clean package -DskipTests

# ---- Runtime image ----
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy the fat JAR from the build stage
COPY --from=build /app/target/slipsync-0.0.1-SNAPSHOT.jar app.jar

# Expose the default Spring Boot port
EXPOSE 8080

ENTRYPOINT ["java","-jar","app.jar"]


