# Keycloak — Local Setup & Custom Login Theme

This guide explains how to run Keycloak locally with Docker, configure the lantern realm, and apply the custom login theme.


## 1. Start Keycloak with Docker
Create and start the Keycloak container:

```docker run -d --name keycloak-local -p 127.0.0.1:8081:8080 -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:26.7.4 start-dev```

Access Keycloak using the following URLs:
- **Login page**: [http://127.0.0.1:8081](http://127.0.0.1:8081)
- **Admin Console**:[http://127.0.0.1:8081/admin/](http://127.0.0.1:8081/admin/)

Default local credentials:
- **Username**: admin
- **Password**: admin

## 2. Create the Lantern Realm
1. Open the Keycloak Admin Console.
2. Click Create realm.
3. Import the following realm configuration file:
```keycloak/realm/lantern-realm.json```
4. Validate the configuration and click Create.

The lantern realm should now be available in Keycloak.

## 3. Configure Realm Login Settings
In the Admin Console, select the lantern realm.
Navigate to Realm settings → Login and enable the following options:
- User registration: ON
- Forgot password: ON
- Remember me: ON
Save the changes.

## 4. Compile the SCSS Stylesheet
The login theme uses SCSS as its source stylesheet.
Whenever you modify lantern.scss, compile it into lantern.css:
```npx sass keycloak/themes/lantern/login/resources/css/lantern.scss keycloak/themes/lantern/login/resources/css/lantern.css```

## 5. Deploy the Custom Theme to Keycloak
Copy the theme directory into the running Keycloak container:
```docker cp keycloak/themes/lantern keycloak-local:/opt/keycloak/themes/```

Restart Keycloak to reload the theme:
```docker restart keycloak-local```

## 6. Enable the Lantern Login Theme
In the Keycloak Admin Console:
1. Select the lantern realm.
2. Navigate to Realm settings → Themes.
3. Set Login theme to lantern.
4. Save the changes.
The custom Lantern login theme should now be applied to the realm's login pages.

## 7. Update the Theme After SCSS Changes
After modifying the SCSS, compile the stylesheet, deploy the theme, and restart Keycloak.

**Option A — Run Each Command Separately**
Compile the SCSS:
```npx sass keycloak/themes/lantern/login/resources/css/lantern.scss keycloak/themes/lantern/login/resources/css/lantern.css```
Copy the updated theme into the container:
```docker cp keycloak/themes/lantern keycloak-local:/opt/keycloak/themes/```
Restart Keycloak:
```docker restart keycloak-local```

**Option B — Run Everything in One Command**
To save time, use the following command to compile the SCSS, copy the updated theme into Docker, and restart Keycloak:
```npx sass keycloak/themes/lantern/login/resources/css/lantern.scss keycloak/themes/lantern/login/resources/css/lantern.css && docker cp keycloak/themes/lantern keycloak-local:/opt/keycloak/themes/ && docker restart keycloak-local```