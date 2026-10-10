<#import "template.ftl" as layout>
<#import "user-profile-commons.ftl" as userProfileCommons>
<#import "register-commons.ftl" as registerCommons>


<div class="auth">
	<div class="auth__side auth__side--left">
		<p class="auth__eyebrow">LANTERN · SECURE ACCESS</p>
		<h1 class="auth__title">LANTERN</h1>
		<h3 class="auth__tagline">Build your party, descend into the dungeon, return a legend.</h3>
		<div class="auth__gallery">
			<div class="auth__gallery-item">
				<img src="${url.resourcesPath}/img/hero1.png" alt="Lantern dungeon" class="auth__gallery-image" />
			</div>
			<div class="auth__gallery-item">
				<img src="${url.resourcesPath}/img/hero4.png" alt="Lantern dungeon" class="auth__gallery-image" />
			</div>
			<div class="auth__gallery-item">
				<img src="${url.resourcesPath}/img/hero2.png" alt="Lantern dungeon" class="auth__gallery-image" />
			</div>
			<div class="auth__gallery-item">
				<img src="${url.resourcesPath}/img/hero3.png" alt="Lantern dungeon" class="auth__gallery-image" />
			</div>
		</div>
		<h5 class="auth__caption">Keycloak theme customized for Lantern</h5>
	</div>

	<@layout.registrationLayout displayMessage=messagesPerField.exists('global') displayRequiredFields=true; section>
		<#if section = "header">
			<#if messageHeader??>
				${kcSanitize(msg("${messageHeader}"))?no_esc}
			<#else>
				${msg("registerTitle")}
			</#if>
		<#elseif section = "form">
			<div class="auth-form__header">
				<p class="auth-form__eyebrow">REGISTER</p>
				<h1 class="auth-form__title">CREATE YOUR ACCOUNT</h1>
				<p class="auth-form__description">One account for all your heroes and games.</p>
			</div>
			<div id="kc-form" class="auth-form">
				<form id="kc-register-form" class="${properties.kcFormClass!} auth-form__fields auth-form__fields--registration" action="${url.registrationAction}" method="post" onsubmit="if (this.dataset.submitting) return false; this.dataset.submitting = 'true'; this.setAttribute('aria-busy', 'true'); this.inert = true; const submitButton = this.querySelector('#kc-register'); if (submitButton) { if (submitButton instanceof HTMLInputElement) { submitButton.value = 'Creating account…'; } else { submitButton.textContent = 'Creating account…'; } submitButton.disabled = true; } return true;">
					<#assign hasRegistrationError = messagesPerField.existsError('password','password-confirm','termsAccepted','global')>
					<#list profile.attributes as attribute>
						<#if messagesPerField.existsError(attribute.name)>
							<#assign hasRegistrationError = true>
						</#if>
					</#list>
					<#if hasRegistrationError>
						<div class="auth-form__alert" role="alert">
							<strong class="auth-form__alert-title">Please fix the highlighted fields</strong>
							<p class="auth-form__alert-description">Your account has not been created yet.</p>
						</div>
					</#if>
					<@userProfileCommons.userProfileFormFields; callback, attribute>
						<#if callback = "afterField">
							<#if passwordRequired?? && (attribute.name == 'username' || (attribute.name == 'email' && realm.registrationEmailAsUsername))>
								<div class="${properties.kcFormGroupClass!}">
									<div class="${properties.kcLabelWrapperClass!}">
										<label for="password" class="${properties.kcLabelClass!}">${msg("password")}</label>
										<span class="auth-form__required">*</span>
									</div>
									<div class="${properties.kcInputWrapperClass!}">
										<div class="${properties.kcInputGroup!} auth-form__password-group" dir="ltr">
											<input type="password" id="password" class="${properties.kcInputClass!}" name="password" placeholder="Create a password" autocomplete="new-password" aria-invalid="<#if messagesPerField.existsError('password','password-confirm')>true</#if>" />
											<button class="${properties.kcFormPasswordVisibilityButtonClass!} auth-form__password-toggle" type="button" aria-label="${msg('showPassword')}" aria-controls="password" data-password-toggle data-icon-show="${properties.kcFormPasswordVisibilityIconShow!}" data-icon-hide="${properties.kcFormPasswordVisibilityIconHide!}" data-label-show="${msg('showPassword')}" data-label-hide="${msg('hidePassword')}">
												<i class="${properties.kcFormPasswordVisibilityIconShow!}" aria-hidden="true"></i>
												</button>
										</div>
										<#if messagesPerField.existsError('password')>
												<span id="input-error-password" class="${properties.kcInputErrorMessageClass!} auth-form__error" aria-live="polite">${kcSanitize(messagesPerField.get('password'))?no_esc}</span>
										</#if>
									</div>
								</div>

								<div class="${properties.kcFormGroupClass!}">
									<div class="${properties.kcLabelWrapperClass!}">
										<label for="password-confirm" class="${properties.kcLabelClass!}">${msg("passwordConfirm")}</label>
										<span class="auth-form__required">*</span>
									</div>
									<div class="${properties.kcInputWrapperClass!}">
										<div class="${properties.kcInputGroup!} auth-form__password-group" dir="ltr">
											<input type="password" id="password-confirm" class="${properties.kcInputClass!}" name="password-confirm" placeholder="Confirm your password" autocomplete="new-password" aria-invalid="<#if messagesPerField.existsError('password-confirm')>true</#if>" />
											<button class="${properties.kcFormPasswordVisibilityButtonClass!} auth-form__password-toggle" type="button" aria-label="${msg('showPassword')}" aria-controls="password-confirm" data-password-toggle data-icon-show="${properties.kcFormPasswordVisibilityIconShow!}" data-icon-hide="${properties.kcFormPasswordVisibilityIconHide!}" data-label-show="${msg('showPassword')}" data-label-hide="${msg('hidePassword')}">
												<i class="${properties.kcFormPasswordVisibilityIconShow!}" aria-hidden="true"></i>
												</button>
										</div>
										<#if messagesPerField.existsError('password-confirm')>
												<span id="input-error-password-confirm" class="${properties.kcInputErrorMessageClass!} auth-form__error" aria-live="polite">${kcSanitize(messagesPerField.get('password-confirm'))?no_esc}</span>
										</#if>
									</div>
								</div>
							</#if>
						</#if>
					</@userProfileCommons.userProfileFormFields>

					<@registerCommons.termsAcceptance/>

					<#if recaptchaRequired?? && (recaptchaVisible!false)>
						<div class="form-group">
							<div class="${properties.kcInputWrapperClass!}">
								<div class="g-recaptcha" data-size="compact" data-sitekey="${recaptchaSiteKey}" data-action="${recaptchaAction}"></div>
							</div>
						</div>
					</#if>

					<div class="${properties.kcFormGroupClass!}">
						<#if recaptchaRequired?? && !(recaptchaVisible!false)>
							<script>
								function onSubmitRecaptcha(token) {
									document.getElementById("kc-register-form").requestSubmit();
								}
							</script>
							<div id="kc-form-buttons" class="${properties.kcFormButtonsClass!} auth-form__actions">
								<button id="kc-register" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!} g-recaptcha" data-sitekey="${recaptchaSiteKey}" data-callback="onSubmitRecaptcha" data-action="${recaptchaAction}" type="submit">${msg("doRegister")}</button>
							</div>
						<#else>
							<div id="kc-form-buttons" class="${properties.kcFormButtonsClass!} auth-form__actions">
								<input id="kc-register" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("doRegister")}" />
							</div>
						</#if>

						<div id="kc-form-options" class="auth-form__footer">
							<a class="auth-form__back-link" href="${url.loginUrl}">${msg("backToLogin")}</a>
							<h5 class="auth-form__security-note">Secured by Keycloak · auth.lantern.gg</h5>
						</div>
					</div>
				</form>
				<script type="module" src="${url.resourcesPath}/js/registerPlaceholders.js"></script>
				<script type="module" src="${url.resourcesPath}/js/passwordVisibility.js"></script>
			</div>
		</#if>
	</@layout.registrationLayout>
</div>