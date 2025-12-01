FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app

# First copy the Clerk backend-api JAR and install it into the local Maven repository
COPY libs/backend-api-3.2.0.jar ./libs/backend-api-3.2.0.jar
RUN mvn install:install-file \
    -Dfile=libs/backend-api-3.2.0.jar \
    -DgroupId=com.clerk \
    -DartifactId=backend-api \
    -Dversion=3.2.0 \
    -Dpackaging=jar

# Now copy the rest of the project and build the Spring Boot JAR.
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


