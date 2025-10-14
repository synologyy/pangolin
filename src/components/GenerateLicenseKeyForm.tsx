"use client";

import { Button } from "@app/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@app/components/ui/form";
import { Input } from "@app/components/ui/input";
import { Checkbox } from "@app/components/ui/checkbox";
import { toast } from "@app/hooks/useToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosResponse } from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import CopyTextBox from "@app/components/CopyTextBox";
import {
    Credenza,
    CredenzaBody,
    CredenzaClose,
    CredenzaContent,
    CredenzaDescription,
    CredenzaFooter,
    CredenzaHeader,
    CredenzaTitle
} from "@app/components/Credenza";
import { formatAxiosError } from "@app/lib/api";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { GenerateNewLicenseResponse } from "@server/routers/generatedLicense/types";
import { useTranslations } from "next-intl";
import React from "react";
import { StrategySelect, StrategyOption } from "./StrategySelect";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { InfoIcon, Check } from "lucide-react";
import { useUserContext } from "@app/hooks/useUserContext";

type FormProps = {
    open: boolean;
    setOpen: (open: boolean) => void;
    orgId: string;
    onGenerated?: () => void;
};

export default function GenerateLicenseKeyForm({
    open,
    setOpen,
    orgId,
    onGenerated
}: FormProps) {
    const t = useTranslations();
    const { env } = useEnvContext();
    const api = createApiClient({ env });

    const { user } = useUserContext();

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [formKey, setFormKey] = useState(0);

    // Step 1: Email & License Type
    const step1Schema = z.object({
        email: z
            .string()
            .email(t("generateLicenseKeyForm.validation.emailRequired")),
        useCaseType: z.enum(["personal", "business"], {
            required_error: t(
                "generateLicenseKeyForm.validation.useCaseTypeRequired"
            )
        })
    });

    // Step 2: Personal Information
    const createStep2Schema = (useCaseType: string | undefined) =>
        z
            .object({
                firstName: z
                    .string()
                    .min(
                        1,
                        t("generateLicenseKeyForm.validation.firstNameRequired")
                    ),
                lastName: z
                    .string()
                    .min(
                        1,
                        t("generateLicenseKeyForm.validation.lastNameRequired")
                    ),
                jobTitle: z.string().optional(),
                primaryUse: z
                    .string()
                    .min(
                        1,
                        t(
                            "generateLicenseKeyForm.validation.primaryUseRequired"
                        )
                    ),
                industry: z.string().optional(),
                prospectiveUsers: z.coerce.number().optional(),
                prospectiveSites: z.coerce.number().optional()
            })
            .refine(
                (data) => {
                    // If business use case, job title is required
                    if (useCaseType === "business") {
                        return data.jobTitle;
                    }
                    return true;
                },
                {
                    message: t(
                        "generateLicenseKeyForm.validation.jobTitleRequiredBusiness"
                    ),
                    path: ["jobTitle"]
                }
            )
            .refine(
                (data) => {
                    // If business use case, industry is required
                    if (useCaseType === "business") {
                        return data.industry;
                    }
                    return true;
                },
                {
                    message: t(
                        "generateLicenseKeyForm.validation.industryRequiredBusiness"
                    ),
                    path: ["industry"]
                }
            );

    // Step 3: Contact Information
    const createStep3Schema = (useCaseType: string | undefined) =>
        z
            .object({
                stateProvinceRegion: z
                    .string()
                    .min(
                        1,
                        t(
                            "generateLicenseKeyForm.validation.stateProvinceRegionRequired"
                        )
                    ),
                postalZipCode: z
                    .string()
                    .min(
                        1,
                        t(
                            "generateLicenseKeyForm.validation.postalZipCodeRequired"
                        )
                    ),
                country: z.string().optional(),
                phoneNumber: z.string().optional(),
                companyName: z.string().optional(),
                countryOfResidence: z.string().optional(),
                companyWebsite: z.string().optional(),
                companyPhoneNumber: z.string().optional()
            })
            .refine(
                (data) => {
                    // If business use case, company name is required
                    if (useCaseType === "business") {
                        return data.companyName;
                    }
                    return true;
                },
                {
                    message: t(
                        "generateLicenseKeyForm.validation.companyNameRequiredBusiness"
                    ),
                    path: ["companyName"]
                }
            )
            .refine(
                (data) => {
                    // If business use case, country of residence is required
                    if (useCaseType === "business") {
                        return data.countryOfResidence;
                    }
                    return true;
                },
                {
                    message: t(
                        "generateLicenseKeyForm.validation.countryOfResidenceRequiredBusiness"
                    ),
                    path: ["countryOfResidence"]
                }
            )
            .refine(
                (data) => {
                    // If personal use case, country is required
                    if (useCaseType === "personal" && !data.country) {
                        return false;
                    }
                    return true;
                },
                {
                    message: t(
                        "generateLicenseKeyForm.validation.countryRequiredPersonal"
                    ),
                    path: ["country"]
                }
            );

    // Step 4: Terms & Generate
    const step4Schema = z.object({
        agreedToTerms: z
            .boolean()
            .refine(
                (val) => val === true,
                t("generateLicenseKeyForm.validation.agreeToTermsRequired")
            ),
        complianceConfirmed: z
            .boolean()
            .refine(
                (val) => val === true,
                t("generateLicenseKeyForm.validation.complianceConfirmationRequired")
            )
    });

    // Complete form schema for final submission with conditional validation
    const createFormSchema = (useCaseType: string | undefined) =>
        z
            .object({
                email: z.string().email("Please enter a valid email address"),
                useCaseType: z.enum(["personal", "business"]),
                firstName: z.string().min(1, "First name is required"),
                lastName: z.string().min(1, "Last name is required"),
                jobTitle: z.string().optional(),
                primaryUse: z
                    .string()
                    .min(1, "Please describe your primary use"),
                industry: z.string().optional(),
                prospectiveUsers: z.coerce.number().optional(),
                prospectiveSites: z.coerce.number().optional(),
                stateProvinceRegion: z
                    .string()
                    .min(
                        1,
                        t(
                            "generateLicenseKeyForm.validation.stateProvinceRegionRequired"
                        )
                    ),
                postalZipCode: z
                    .string()
                    .min(
                        1,
                        t(
                            "generateLicenseKeyForm.validation.postalZipCodeRequired"
                        )
                    ),
                country: z.string().optional(),
                phoneNumber: z.string().optional(),
                companyName: z.string().optional(),
                countryOfResidence: z.string().optional(),
                companyWebsite: z.string().optional(),
                companyPhoneNumber: z.string().optional(),
                agreedToTerms: z
                    .boolean()
                    .refine(
                        (val) => val === true,
                        t(
                            "generateLicenseKeyForm.validation.agreeToTermsRequired"
                        )
                    ),
                complianceConfirmed: z
                    .boolean()
                    .refine(
                        (val) => val === true,
                        t("generateLicenseKeyForm.validation.complianceConfirmationRequired")
                    )
            })
            .refine(
                (data) => {
                    // If business use case, job title is required
                    if (useCaseType === "business") {
                        return data.jobTitle;
                    }
                    return true;
                },
                {
                    message: t(
                        "generateLicenseKeyForm.validation.jobTitleRequiredBusiness"
                    ),
                    path: ["jobTitle"]
                }
            )
            .refine(
                (data) => {
                    // If business use case, industry is required
                    if (useCaseType === "business") {
                        return data.industry;
                    }
                    return true;
                },
                {
                    message: t(
                        "generateLicenseKeyForm.validation.industryRequiredBusiness"
                    ),
                    path: ["industry"]
                }
            )
            .refine(
                (data) => {
                    // If business use case, company name is required
                    if (useCaseType === "business") {
                        return data.companyName;
                    }
                    return true;
                },
                {
                    message: t(
                        "generateLicenseKeyForm.validation.companyNameRequiredBusiness"
                    ),
                    path: ["companyName"]
                }
            )
            .refine(
                (data) => {
                    // If business use case, country of residence is required
                    if (useCaseType === "business") {
                        return data.countryOfResidence;
                    }
                    return true;
                },
                {
                    message: t(
                        "generateLicenseKeyForm.validation.countryOfResidenceRequiredBusiness"
                    ),
                    path: ["countryOfResidence"]
                }
            )
            .refine(
                (data) => {
                    // If personal use case, country is required
                    if (useCaseType === "personal") {
                        return data.country;
                    }
                    return true;
                },
                {
                    message: t(
                        "generateLicenseKeyForm.validation.countryRequiredPersonal"
                    ),
                    path: ["country"]
                }
            );

    type FormData = z.infer<ReturnType<typeof createFormSchema>>;

    // Base schema for form initialization (without conditional validation)
    const baseFormSchema = z.object({
        email: z.string().email("Please enter a valid email address"),
        useCaseType: z.enum(["personal", "business"]),
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        jobTitle: z.string().optional(),
        primaryUse: z.string().min(1, "Please describe your primary use"),
        industry: z.string().optional(),
        prospectiveUsers: z.coerce.number().optional(),
        prospectiveSites: z.coerce.number().optional(),
        stateProvinceRegion: z
            .string()
            .min(1, "State/Province/Region is required"),
        postalZipCode: z.string().min(1, "Postal/ZIP Code is required"),
        country: z.string().optional(),
        phoneNumber: z.string().optional(),
        companyName: z.string().optional(),
        countryOfResidence: z.string().optional(),
        companyWebsite: z.string().optional(),
        companyPhoneNumber: z.string().optional(),
        agreedToTerms: z
            .boolean()
            .refine(
                (val) => val === true,
                t("generateLicenseKeyForm.validation.agreeToTermsRequired")
            ),
        complianceConfirmed: z
            .boolean()
            .refine(
                (val) => val === true,
                t("generateLicenseKeyForm.validation.complianceConfirmationRequired")
            )
    });

    const form = useForm<FormData>({
        resolver: zodResolver(baseFormSchema),
        defaultValues: {
            email: user?.email || "",
            useCaseType: undefined,
            firstName: "",
            lastName: "",
            jobTitle: "",
            primaryUse: "",
            industry: "",
            prospectiveUsers: undefined,
            prospectiveSites: undefined,
            stateProvinceRegion: "",
            postalZipCode: "",
            country: "",
            phoneNumber: "",
            companyName: "",
            countryOfResidence: "",
            companyWebsite: "",
            companyPhoneNumber: "",
            agreedToTerms: false,
            complianceConfirmed: false
        }
    });

    const useCaseType = form.watch("useCaseType");
    const [previousUseCaseType, setPreviousUseCaseType] = useState<
        string | undefined
    >(undefined);

    // Reset form when use case type changes
    React.useEffect(() => {
        if (
            useCaseType !== previousUseCaseType &&
            useCaseType &&
            previousUseCaseType
        ) {
            // Reset fields that are specific to use case type
            form.setValue("jobTitle", "");
            form.setValue("prospectiveUsers", undefined);
            form.setValue("prospectiveSites", undefined);
            form.setValue("companyName", "");
            form.setValue("countryOfResidence", "");
            form.setValue("companyWebsite", "");
            form.setValue("companyPhoneNumber", "");
            form.setValue("phoneNumber", "");
            form.setValue("country", "");

            setPreviousUseCaseType(useCaseType);
        }
    }, [useCaseType, previousUseCaseType, form]);

    // Reset form when dialog opens
    React.useEffect(() => {
        if (open) {
            form.reset({
                email: user?.email || "",
                useCaseType: undefined,
                firstName: "",
                lastName: "",
                jobTitle: "",
                primaryUse: "",
                industry: "",
                prospectiveUsers: undefined,
                prospectiveSites: undefined,
                stateProvinceRegion: "",
                postalZipCode: "",
                country: "",
                phoneNumber: "",
                companyName: "",
                countryOfResidence: "",
                companyWebsite: "",
                companyPhoneNumber: "",
                agreedToTerms: false,
                complianceConfirmed: false
            });
            setCurrentStep(1);
            setGeneratedKey(null);
            setPreviousUseCaseType(undefined);
        }
    }, [open, form, user?.email]);

    const useCaseOptions: StrategyOption<"personal" | "business">[] = [
        {
            id: "personal",
            title: t("generateLicenseKeyForm.useCaseOptions.personal.title"),
            description: (
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-2">
                        {t(
                            "generateLicenseKeyForm.useCaseOptions.personal.description"
                        )}
                    </p>
                    <ul className="space-y-2">
                        <li className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-muted-foreground break-words">
                                Home-lab enthusiasts and self-hosting hobbyists
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-muted-foreground break-words">
                                Personal projects, learning, and experimentation
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-muted-foreground break-words">
                                Individual developers and tech enthusiasts
                            </span>
                        </li>
                    </ul>
                </div>
            )
        },
        {
            id: "business",
            title: t("generateLicenseKeyForm.useCaseOptions.business.title"),
            description: (
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-2">
                        {t(
                            "generateLicenseKeyForm.useCaseOptions.business.description"
                        )}
                    </p>
                    <ul className="space-y-2">
                        <li className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-muted-foreground break-words">
                                Companies, startups, and organizations
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-muted-foreground break-words">
                                Professional services and client work
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-muted-foreground break-words">
                                Revenue-generating or commercial use cases
                            </span>
                        </li>
                    </ul>
                </div>
            )
        }
    ];

    const steps = [
        {
            title: t("generateLicenseKeyForm.steps.emailLicenseType.title"),
            description: t(
                "generateLicenseKeyForm.steps.emailLicenseType.description"
            )
        },
        {
            title: t("generateLicenseKeyForm.steps.personalInformation.title"),
            description: t(
                "generateLicenseKeyForm.steps.personalInformation.description"
            )
        },
        {
            title: t("generateLicenseKeyForm.steps.contactInformation.title"),
            description: t(
                "generateLicenseKeyForm.steps.contactInformation.description"
            )
        },
        {
            title: t("generateLicenseKeyForm.steps.termsGenerate.title"),
            description: t(
                "generateLicenseKeyForm.steps.termsGenerate.description"
            )
        }
    ];

    const nextStep = async () => {
        let isValid = false;

        try {
            // Validate current step based on step number
            switch (currentStep) {
                case 1:
                    await step1Schema.parseAsync(form.getValues());
                    isValid = true;
                    break;
                case 2:
                    await createStep2Schema(
                        form.getValues("useCaseType")
                    ).parseAsync(form.getValues());
                    isValid = true;
                    break;
                case 3:
                    await createStep3Schema(
                        form.getValues("useCaseType")
                    ).parseAsync(form.getValues());
                    isValid = true;
                    break;
                case 4:
                    await step4Schema.parseAsync(form.getValues());
                    isValid = true;
                    break;
                default:
                    isValid = false;
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                // Set form errors for the current step fields
                error.errors.forEach((err) => {
                    const fieldName = err.path[0] as keyof FormData;
                    form.setError(fieldName, {
                        type: "manual",
                        message: err.message
                    });
                });
            }
            return;
        }

        if (isValid && currentStep < steps.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const onSubmit = async (values: FormData) => {
        // Validate with the dynamic schema before submission
        try {
            await createFormSchema(values.useCaseType).parseAsync(values);
        } catch (error) {
            if (error instanceof z.ZodError) {
                // Set form errors for any validation failures
                error.errors.forEach((err) => {
                    const fieldName = err.path[0] as keyof FormData;
                    form.setError(fieldName, {
                        type: "manual",
                        message: err.message
                    });
                });
                return;
            }
        }

        setLoading(true);
        try {
            const payload = {
                email: values.email,
                useCaseType: values.useCaseType,
                personal:
                    values.useCaseType === "personal"
                        ? {
                              firstName: values.firstName,
                              lastName: values.lastName,
                              aboutYou: {
                                  primaryUse: values.primaryUse
                              },
                              personalInfo: {
                                  stateProvinceRegion:
                                      values.stateProvinceRegion,
                                  postalZipCode: values.postalZipCode,
                                  country: values.country,
                                  phoneNumber: values.phoneNumber || ""
                              }
                          }
                        : undefined,
                business:
                    values.useCaseType === "business"
                        ? {
                              firstName: values.firstName,
                              lastName: values.lastName,
                              jobTitle: values.jobTitle || "",
                              aboutYou: {
                                  primaryUse: values.primaryUse,
                                  industry: values.industry,
                                  prospectiveUsers:
                                      values.prospectiveUsers || undefined,
                                  prospectiveSites:
                                      values.prospectiveSites || undefined
                              },
                              companyInfo: {
                                  companyName: values.companyName || "",
                                  countryOfResidence:
                                      values.countryOfResidence || "",
                                  stateProvinceRegion:
                                      values.stateProvinceRegion,
                                  postalZipCode: values.postalZipCode,
                                  companyWebsite: values.companyWebsite || "",
                                  companyPhoneNumber:
                                      values.companyPhoneNumber || ""
                              }
                          }
                        : undefined,
                consent: {
                    agreedToTerms: values.agreedToTerms,
                    acknowledgedPrivacyPolicy: values.agreedToTerms,
                    complianceConfirmed: values.complianceConfirmed
                }
            };

            const response = await api.put<
                AxiosResponse<GenerateNewLicenseResponse>
            >(`/org/${orgId}/license`, payload);

            if (response.data.data?.licenseKey?.licenseKey) {
                setGeneratedKey(response.data.data.licenseKey.licenseKey);
                onGenerated?.();
                toast({
                    title: t("generateLicenseKeyForm.toasts.success.title"),
                    description: t(
                        "generateLicenseKeyForm.toasts.success.description"
                    ),
                    variant: "default"
                });
            }
        } catch (e) {
            console.error(e);
            toast({
                title: t("generateLicenseKeyForm.toasts.error.title"),
                description: formatAxiosError(
                    e,
                    t("generateLicenseKeyForm.toasts.error.description")
                ),
                variant: "destructive"
            });
        }
        setLoading(false);
    };

    const handleClose = () => {
        setOpen(false);
        setCurrentStep(1);
        setGeneratedKey(null);
        setFormKey((prev) => prev + 1); // Force form reset by changing key
        form.reset({
            email: user?.email || "",
            useCaseType: undefined,
            firstName: "",
            lastName: "",
            jobTitle: "",
            primaryUse: "",
            industry: "",
            prospectiveUsers: undefined,
            prospectiveSites: undefined,
            stateProvinceRegion: "",
            postalZipCode: "",
            country: "",
            phoneNumber: "",
            companyName: "",
            countryOfResidence: "",
            companyWebsite: "",
            companyPhoneNumber: "",
            agreedToTerms: false,
            complianceConfirmed: false
        });
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-4">
                        <Alert variant="neutral" className="mb-8">
                            <InfoIcon className="h-4 w-4" />
                            <AlertTitle>
                                {t(
                                    "generateLicenseKeyForm.alerts.commercialUseDisclosure.title"
                                )}
                            </AlertTitle>
                            <AlertDescription>
                                {t(
                                    "generateLicenseKeyForm.alerts.commercialUseDisclosure.description"
                                ).split("Fossorial Commercial License Terms").map((part, index) => (
                                    <span key={index}>
                                        {part}
                                        {index === 0 && (
                                            <a
                                                href="https://digpangolin.com/fcl.html"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline"
                                            >
                                                Fossorial Commercial License Terms
                                            </a>
                                        )}
                                    </span>
                                ))}
                            </AlertDescription>
                        </Alert>

                        <FormField
                            control={form.control}
                            name="useCaseType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="mb-2">
                                        {t(
                                            "generateLicenseKeyForm.form.useCaseQuestion"
                                        )}
                                    </FormLabel>
                                    <StrategySelect
                                        options={useCaseOptions}
                                        defaultValue={field.value}
                                        onChange={(value) => {
                                            field.onChange(value);
                                            // Reset form when use case type changes
                                            form.reset({
                                                email: user?.email || "",
                                                useCaseType: value,
                                                firstName: "",
                                                lastName: "",
                                                jobTitle: "",
                                                primaryUse: "",
                                                industry: "",
                                                prospectiveUsers: undefined,
                                                prospectiveSites: undefined,
                                                stateProvinceRegion: "",
                                                postalZipCode: "",
                                                country: "",
                                                phoneNumber: "",
                                                companyName: "",
                                                countryOfResidence: "",
                                                companyWebsite: "",
                                                companyPhoneNumber: "",
                                                agreedToTerms: false,
                                                complianceConfirmed: false
                                            });
                                        }}
                                        cols={2}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="firstName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t(
                                                "generateLicenseKeyForm.form.firstName"
                                            )}
                                        </FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="lastName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t(
                                                "generateLicenseKeyForm.form.lastName"
                                            )}
                                        </FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {useCaseType === "business" && (
                            <FormField
                                control={form.control}
                                name="jobTitle"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t(
                                                "generateLicenseKeyForm.form.jobTitle"
                                            )}
                                        </FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="primaryUse"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t(
                                                "generateLicenseKeyForm.form.primaryUseQuestion"
                                            )}
                                        </FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {useCaseType === "business" && (
                                <>
                                    <FormField
                                        control={form.control}
                                        name="industry"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "generateLicenseKeyForm.form.industryQuestion"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="prospectiveUsers"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "generateLicenseKeyForm.form.prospectiveUsersQuestion"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="prospectiveSites"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "generateLicenseKeyForm.form.prospectiveSitesQuestion"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-4">
                        {useCaseType === "business" && (
                            <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="companyName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                {t(
                                                    "generateLicenseKeyForm.form.companyName"
                                                )}
                                            </FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="countryOfResidence"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                {t(
                                                    "generateLicenseKeyForm.form.countryOfResidence"
                                                )}
                                            </FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="stateProvinceRegion"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "generateLicenseKeyForm.form.stateProvinceRegion"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="postalZipCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "generateLicenseKeyForm.form.postalZipCode"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="companyWebsite"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "generateLicenseKeyForm.form.companyWebsite"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="companyPhoneNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "generateLicenseKeyForm.form.companyPhoneNumber"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {useCaseType === "personal" && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="stateProvinceRegion"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "generateLicenseKeyForm.form.stateProvinceRegion"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="postalZipCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "generateLicenseKeyForm.form.postalZipCode"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="country"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "generateLicenseKeyForm.form.country"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="phoneNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "generateLicenseKeyForm.form.phoneNumberOptional"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="agreedToTerms"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel className="text-sm font-normal">
                                            <div>
                                                {t("signUpTerms.IAgreeToThe")}{" "}
                                                <a
                                                    href="https://digpangolin.com/terms-of-service.html"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline"
                                                >
                                                    {t(
                                                        "signUpTerms.termsOfService"
                                                    )}{" "}
                                                </a>
                                                {t("signUpTerms.and")}{" "}
                                                <a
                                                    href="https://digpangolin.com/privacy-policy.html"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline"
                                                >
                                                    {t(
                                                        "signUpTerms.privacyPolicy"
                                                    )}
                                                </a>
                                            </div>
                                        </FormLabel>
                                        <FormMessage />
                                    </div>
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="complianceConfirmed"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel className="text-sm font-normal">
                                            <div>
                                                I confirm that I am in compliance with the{" "}
                                                <a
                                                    href="https://digpangolin.com/fcl.html"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline"
                                                >
                                                    Fossorial Commercial License
                                                </a>{" "}
                                                and that reporting inaccurate information or misidentifying use of the product is a violation of the license.
                                            </div>
                                        </FormLabel>
                                        <FormMessage />
                                    </div>
                                </FormItem>
                            )}
                        />
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Credenza open={open} onOpenChange={handleClose}>
            <CredenzaContent className="max-w-4xl">
                <CredenzaHeader>
                    <CredenzaTitle>{t("generateLicenseKey")}</CredenzaTitle>
                    <CredenzaDescription>
                        {steps[currentStep - 1]?.description}
                    </CredenzaDescription>
                </CredenzaHeader>
                <CredenzaBody>
                    <div className="space-y-6">
                        {/* Progress indicator */}
                        <div className="flex justify-between mb-4">
                            {steps.map((step, index) => (
                                <div
                                    key={index}
                                    className="flex flex-col items-center"
                                >
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                                            index + 1 <= currentStep
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground"
                                        }`}
                                    >
                                        {index + 1}
                                    </div>
                                    <span
                                        className={`text-sm font-medium ${
                                            index + 1 <= currentStep
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        }`}
                                    >
                                        {step.title}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {generatedKey ? (
                            <div className="space-y-4">
                                {useCaseType === "business" && (
                                    <Alert variant="neutral">
                                        <AlertTitle>
                                            {t(
                                                "generateLicenseKeyForm.alerts.trialPeriodInformation.title"
                                            )}
                                        </AlertTitle>
                                        <AlertDescription>
                                            {t(
                                                "generateLicenseKeyForm.alerts.trialPeriodInformation.description"
                                            )}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <CopyTextBox
                                    text={generatedKey}
                                    wrapText={false}
                                />
                            </div>
                        ) : (
                            <Form {...form} key={formKey}>
                                <form
                                    onSubmit={form.handleSubmit(onSubmit)}
                                    className="space-y-4"
                                >
                                    {renderStepContent()}
                                </form>
                            </Form>
                        )}
                    </div>
                </CredenzaBody>
                <CredenzaFooter>
                    <CredenzaClose asChild>
                        <Button variant="outline">
                            {t("generateLicenseKeyForm.buttons.close")}
                        </Button>
                    </CredenzaClose>

                    {!generatedKey && (
                        <>
                            {currentStep > 1 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={prevStep}
                                    disabled={loading}
                                >
                                    {t(
                                        "generateLicenseKeyForm.buttons.previous"
                                    )}
                                </Button>
                            )}

                            {currentStep < steps.length ? (
                                <Button
                                    type="button"
                                    onClick={nextStep}
                                    disabled={loading}
                                >
                                    {t("generateLicenseKeyForm.buttons.next")}
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={form.handleSubmit(onSubmit)}
                                    loading={loading}
                                    disabled={loading}
                                >
                                    {t(
                                        "generateLicenseKeyForm.buttons.generateLicenseKey"
                                    )}
                                </Button>
                            )}
                        </>
                    )}
                </CredenzaFooter>
            </CredenzaContent>
        </Credenza>
    );
}
