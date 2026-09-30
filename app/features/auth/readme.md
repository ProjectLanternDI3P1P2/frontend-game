# Run Keycloak Docker 
```docker run -d --name keycloak-local -p 127.0.0.1:8081:8080 -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:26.7.4 start-dev```

# Login Page Keycloak
localhost:8081

# To Update CSS style on Keycloak login
```docker cp keycloak/themes/lantern keycloak-local:/opt/keycloak/themes/```
```docker restart keycloak-local```