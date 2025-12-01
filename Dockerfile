FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app

# Install git (needed to fetch the Clerk Java SDK source)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Clone and install the Clerk Java SDK so that com.clerk:backend-api is available in the local Maven repo
RUN git clone https://github.com/clerk/clerk-sdk-java.git /tmp/clerk-sdk-java \
    && cd /tmp/clerk-sdk-java \
    && mvn -pl backend-api -am install -DskipTests

# Copy everything and build the Spring Boot JAR
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


