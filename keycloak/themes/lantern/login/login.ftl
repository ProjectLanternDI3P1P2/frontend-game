<#import "template.ftl" as layout>
<#import "passkeys.ftl" as passkeys>

<div class="auth">
	<div class="auth__side auth__side--left">
		<p class="auth__eyebrow">LANTERN · SECURE ACCESS</p>
		<h1 class="auth__title">LANTERN</h1>
		<h3 class="auth__tagline">Build your party, descend into the dungeon, return a legend.</h3>
		<div class="auth__gallery">
			<div class="auth__gallery-item auth__gallery-item--warrior">
				<span class="auth__gallery-sprite" role="img" aria-label="Warrior"></span>
				<span class="auth__gallery-label">Warrior</span>
			</div>
			<div class="auth__gallery-item auth__gallery-item--shaman">
				<span class="auth__gallery-sprite" role="img" aria-label="Shaman"></span>
				<span class="auth__gallery-label">Shaman</span>
			</div>
			<div class="auth__gallery-item auth__gallery-item--mage">
				<span class="auth__gallery-sprite" role="img" aria-label="Mage"></span>
				<span class="auth__gallery-label">Mage</span>
			</div>
		</div>
		<h5 class="auth__caption">Keycloak theme customized for Lantern</h5>
	</div>

	<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=realm.password && realm.registrationAllowed && !registrationDisabled??; section>
		<#if section="header">
			${msg("loginAccountTitle")}
		<#elseif section = "form">
			<div class="auth-form__header">
				<p class="auth-form__eyebrow">SIGN IN</p>
				<h1 class="auth-form__title">WELCOME BACK</h1>
				<p class="auth-form__description">Sign in with your Lantern account to join your party.</p>
			</div>
			<div id="kc-form" class="auth-form">
				<div id="kc-form-wrapper">
					<#if realm.password>
						<form id="kc-form-login" class="auth-form__fields" action="${url.loginAction}" method="post" onsubmit="if (this.dataset.submitting) return false; this.dataset.submitting = 'true'; this.setAttribute('aria-busy', 'true'); this.inert = true; const submitButton = this.querySelector('#kc-login'); submitButton.value = 'Signing in…'; submitButton.disabled = true; return true;">
							<#if messagesPerField.existsError('username','password')>
								<div class="auth-form__alert" role="alert">
									<strong class="auth-form__alert-title">Invalid username or password</strong>
									<p class="auth-form__alert-description">Check your credentials and try again. After 5 failed attempts, your account is temporarily locked.</p>
								</div>
							</#if>
							<#if !usernameHidden??>
								<div class="${properties.kcFormGroupClass!}">
									<label for="username" class="${properties.kcLabelClass!}"><#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if></label>
									<input id="username" name="username" class="${properties.kcInputClass!}" value="${(login.username!'')}" type="text" autofocus autocomplete="username" placeholder="e.g. morwen or morwen@mail.com" aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>" dir="ltr" />
									<#if messagesPerField.existsError('username','password')>
										<span id="input-error" class="${properties.kcInputErrorMessageClass!} auth-form__error" aria-live="polite">${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}</span>
									</#if>
								</div>
							</#if>

							<div class="${properties.kcFormGroupClass!}">
								<label for="password" class="${properties.kcLabelClass!}">${msg("password")}</label>
								<div class="${properties.kcInputGroup!} auth-form__password-group" dir="ltr">
									<input id="password" name="password" class="${properties.kcInputClass!}" type="password" placeholder="Enter your password" autocomplete="current-password" aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>" />
									<button class="${properties.kcFormPasswordVisibilityButtonClass!} auth-form__password-toggle" type="button" aria-label="${msg('showPassword')}" aria-controls="password" data-password-toggle data-icon-show="${properties.kcFormPasswordVisibilityIconShow!}" data-icon-hide="${properties.kcFormPasswordVisibilityIconHide!}" data-label-show="${msg('showPassword')}" data-label-hide="${msg('hidePassword')}">
										<i class="${properties.kcFormPasswordVisibilityIconShow!}" aria-hidden="true"></i>
									</button>
								</div>
								<#if usernameHidden?? && messagesPerField.existsError('username','password')>
									<span id="input-error" class="${properties.kcInputErrorMessageClass!} auth-form__error" aria-live="polite">${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}</span>
								</#if>
							</div>

							<div class="${properties.kcFormGroupClass!} ${properties.kcFormSettingClass!} auth-form__options">
								<div id="kc-form-options">
									<#if realm.rememberMe && !usernameHidden??>
										<div class="checkbox auth-form__remember">
											<label>
												<input class="auth-form__remember-input" id="rememberMe" name="rememberMe" type="checkbox" <#if login.rememberMe??>checked</#if>>
												${msg("rememberMe")}
											</label>
										</div>
									</#if>
								</div>
								<div class="${properties.kcFormOptionsWrapperClass!} auth-form__forgot-password">
									<#if realm.resetPasswordAllowed>
										<a href="${url.loginResetCredentialsUrl}">${msg("doForgotPassword")}</a>
									</#if>
								</div>
							</div>

							<div id="kc-form-buttons" class="${properties.kcFormGroupClass!} auth-form__actions">
								<input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if> />
								<input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" name="login" id="kc-login" type="submit" value="${msg("doLogIn")}" />
							</div>
						</form>
					</#if>
				</div>
			</div>
			<@passkeys.conditionalUIData />
			<script type="module" src="${url.resourcesPath}/js/passwordVisibility.js"></script>
			
			<#elseif section = "info">
				<hr>
				<#if realm.password && realm.registrationAllowed && !registrationDisabled??>
						<div id="kc-registration-container">
							<div id="kc-registration" class="auth-form__registration">
								<span class="auth-form__registration-prompt">New to Lantern?</span>
								<a class="auth-form__registration-link" href="${url.registrationUrl}">${msg("doRegister")}</a>
						</div>
					</div>
				</#if>

		<h5 class="auth-form__security-note">Secured by Keycloak · auth.lantern.gg</h5>
		<#elseif section = "socialProviders">
			<#if realm.password && social?? && social.providers?has_content>
				<div id="kc-social-providers" class="${properties.kcFormSocialAccountSectionClass!}">
					<h2>${msg("identity-provider-login-label")}</h2>
					<ul class="${properties.kcFormSocialAccountListClass!} <#if social.providers?size gt 3>${properties.kcFormSocialAccountListGridClass!}</#if>">
						<#list social.providers as provider>
							<li>
								<a data-once-link data-disabled-class="${properties.kcFormSocialAccountListButtonDisabledClass!}" id="social-${provider.alias}" class="${properties.kcFormSocialAccountListButtonClass!}" href="${provider.loginUrl}">
									<#if provider.iconClasses?has_content><i class="${properties.kcCommonLogoIdP!} ${provider.iconClasses!}" aria-hidden="true"></i></#if>
									<span class="${properties.kcFormSocialAccountNameClass!}">${provider.displayName!}</span>
								</a>
							</li>
						</#list>
					</ul>
				</div>
			</#if>
		</#if>
	</@layout.registrationLayout>
</div>
