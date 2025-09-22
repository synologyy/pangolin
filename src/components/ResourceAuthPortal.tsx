"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form";
import { LockIcon, Binary, Key, User, Send, AtSign } from "lucide-react";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot
} from "@app/components/ui/input-otp";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@app/components/ui/alert";
import { formatAxiosError } from "@app/lib/api";
import { AxiosResponse } from "axios";
import LoginForm, { LoginFormIDP } from "@app/components/LoginForm";
import {
    AuthWithPasswordResponse,
    AuthWithWhitelistResponse
} from "@server/routers/resource";
import ResourceAccessDenied from "@app/components/ResourceAccessDenied";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { toast } from "@app/hooks/useToast";
import Link from "next/link";
import Image from "next/image";
import { useSupporterStatusContext } from "@app/hooks/useSupporterStatusContext";
import { useTranslations } from "next-intl";

const pinSchema = z.object({
    pin: z
        .string()
        .length(6, { message: "PIN must be exactly 6 digits" })
        .regex(/^\d+$/, { message: "PIN must only contain numbers" })
});

const passwordSchema = z.object({
    password: z.string().min(1, {
        message: "Password must be at least 1 character long"
    })
});

const requestOtpSchema = z.object({
    email: z.string().email()
});

const submitOtpSchema = z.object({
    email: z.string().email(),
    otp: z.string().min(1, {
        message: "OTP must be at least 1 character long"
    })
});

type ResourceAuthPortalProps = {
    methods: {
        password: boolean;
        pincode: boolean;
        sso: boolean;
        whitelist: boolean;
    };
    resource: {
        name: string;
        id: number;
    };
    redirect: string;
    idps?: LoginFormIDP[];
};

export default function ResourceAuthPortal(props: ResourceAuthPortalProps) {
    const router = useRouter();
    const t = useTranslations();

    const getNumMethods = () => {
        let colLength = 0;
        if (props.methods.pincode) colLength++;
        if (props.methods.password) colLength++;
        if (props.methods.sso) colLength++;
        if (props.methods.whitelist) colLength++;
        return colLength;
    };

    const [numMethods, setNumMethods] = useState(getNumMethods());

    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [pincodeError, setPincodeError] = useState<string | null>(null);
    const [whitelistError, setWhitelistError] = useState<string | null>(null);
    const [accessDenied, setAccessDenied] = useState<boolean>(false);
    const [loadingLogin, setLoadingLogin] = useState(false);

    const [otpState, setOtpState] = useState<"idle" | "otp_sent">("idle");

    const { env } = useEnvContext();

    const api = createApiClient({ env });

    const { supporterStatus } = useSupporterStatusContext();

    function getDefaultSelectedMethod() {
        if (props.methods.sso) {
            return "sso";
        }

        if (props.methods.password) {
            return "password";
        }

        if (props.methods.pincode) {
            return "pin";
        }

        if (props.methods.whitelist) {
            return "whitelist";
        }
    }

    const [activeTab, setActiveTab] = useState(getDefaultSelectedMethod());

    const pinForm = useForm({
        resolver: zodResolver(pinSchema),
        defaultValues: {
            pin: ""
        }
    });

    const passwordForm = useForm({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            password: ""
        }
    });

    const requestOtpForm = useForm({
        resolver: zodResolver(requestOtpSchema),
        defaultValues: {
            email: ""
        }
    });

    const submitOtpForm = useForm({
        resolver: zodResolver(submitOtpSchema),
        defaultValues: {
            email: "",
            otp: ""
        }
    });

    function appendRequestToken(url: string, token: string) {
        const fullUrl = new URL(url);
        fullUrl.searchParams.append(
            env.server.resourceSessionRequestParam,
            token
        );
        return fullUrl.toString();
    }

    const onWhitelistSubmit = (values: any) => {
        setLoadingLogin(true);
        api.post<AxiosResponse<AuthWithWhitelistResponse>>(
            `/auth/resource/${props.resource.id}/whitelist`,
            { email: values.email, otp: values.otp }
        )
            .then((res) => {
                setWhitelistError(null);

                if (res.data.data.otpSent) {
                    setOtpState("otp_sent");
                    submitOtpForm.setValue("email", values.email);
                    toast({
                        title: t("otpEmailSent"),
                        description: t("otpEmailSentDescription")
                    });
                    return;
                }

                const session = res.data.data.session;
                if (session) {
                    window.location.href = appendRequestToken(
                        props.redirect,
                        session
                    );
                }
            })
            .catch((e) => {
                console.error(e);
                setWhitelistError(
                    formatAxiosError(e, t("otpEmailErrorAuthenticate"))
                );
            })
            .then(() => setLoadingLogin(false));
    };

    const onPinSubmit = (values: z.infer<typeof pinSchema>) => {
        setLoadingLogin(true);
        api.post<AxiosResponse<AuthWithPasswordResponse>>(
            `/auth/resource/${props.resource.id}/pincode`,
            { pincode: values.pin }
        )
            .then((res) => {
                setPincodeError(null);
                const session = res.data.data.session;
                if (session) {
                    window.location.href = appendRequestToken(
                        props.redirect,
                        session
                    );
                }
            })
            .catch((e) => {
                console.error(e);
                setPincodeError(
                    formatAxiosError(e, t("pincodeErrorAuthenticate"))
                );
            })
            .then(() => setLoadingLogin(false));
    };

    const onPasswordSubmit = (values: z.infer<typeof passwordSchema>) => {
        setLoadingLogin(true);

        api.post<AxiosResponse<AuthWithPasswordResponse>>(
            `/auth/resource/${props.resource.id}/password`,
            {
                password: values.password
            }
        )
            .then((res) => {
                setPasswordError(null);
                const session = res.data.data.session;
                if (session) {
                    window.location.href = appendRequestToken(
                        props.redirect,
                        session
                    );
                }
            })
            .catch((e) => {
                console.error(e);
                setPasswordError(
                    formatAxiosError(e, t("passwordErrorAuthenticate"))
                );
            })
            .finally(() => setLoadingLogin(false));
    };

    async function handleSSOAuth() {
        let isAllowed = false;
        try {
            await api.get(`/resource/${props.resource.id}`);
            isAllowed = true;
        } catch (e) {
            setAccessDenied(true);
        }

        if (isAllowed) {
            // window.location.href = props.redirect;
            router.refresh();
        }
    }

    function getTitle() {
        return t("authenticationRequired");
    }

    function getSubtitle(resourceName: string) {
        return numMethods > 1
            ? t("authenticationMethodChoose", { name: props.resource.name })
            : t("authenticationRequest", { name: props.resource.name });
    }

    return (
        <div>
            {!accessDenied ? (
                <div>
                    <div className="text-center mb-2">
                        <span className="text-sm text-muted-foreground">
                            {t("poweredBy")}{" "}
                            <Link
                                href="https://github.com/fosrl/pangolin"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                            >
                                Pangolin
                            </Link>
                        </span>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle>{getTitle()}</CardTitle>
                            <CardDescription>
                                {getSubtitle(props.resource.name)}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs
                                value={activeTab}
                                onValueChange={setActiveTab}
                                orientation="horizontal"
                            >
                                {numMethods > 1 && (
                                    <TabsList
                                        className={`grid w-full ${
                                            numMethods === 1
                                                ? "grid-cols-1"
                                                : numMethods === 2
                                                  ? "grid-cols-2"
                                                  : numMethods === 3
                                                    ? "grid-cols-3"
                                                    : "grid-cols-4"
                                        }`}
                                    >
                                        {props.methods.pincode && (
                                            <TabsTrigger value="pin">
                                                <Binary className="w-4 h-4 mr-1" />{" "}
                                                PIN
                                            </TabsTrigger>
                                        )}
                                        {props.methods.password && (
                                            <TabsTrigger value="password">
                                                <Key className="w-4 h-4 mr-1" />{" "}
                                                {t("password")}
                                            </TabsTrigger>
                                        )}
                                        {props.methods.sso && (
                                            <TabsTrigger value="sso">
                                                <User className="w-4 h-4 mr-1" />{" "}
                                                {t("user")}
                                            </TabsTrigger>
                                        )}
                                        {props.methods.whitelist && (
                                            <TabsTrigger value="whitelist">
                                                <AtSign className="w-4 h-4 mr-1" />{" "}
                                                {t("email")}
                                            </TabsTrigger>
                                        )}
                                    </TabsList>
                                )}
                                {props.methods.pincode && (
                                    <TabsContent
                                        value="pin"
                                        className={`${numMethods <= 1 ? "mt-0" : ""}`}
                                    >
                                        <Form {...pinForm}>
                                            <form
                                                onSubmit={pinForm.handleSubmit(
                                                    onPinSubmit
                                                )}
                                                className="space-y-4"
                                            >
                                                <FormField
                                                    control={pinForm.control}
                                                    name="pin"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                {t(
                                                                    "pincodeInput"
                                                                )}
                                                            </FormLabel>
                                                            <FormControl>
                                                                <div className="flex justify-center">
                                                                    <InputOTP
                                                                        maxLength={
                                                                            6
                                                                        }
                                                                        {...field}
                                                                    >
                                                                        <InputOTPGroup className="flex">
                                                                            <InputOTPSlot
                                                                                index={
                                                                                    0
                                                                                }
                                                                                obscured
                                                                            />
                                                                            <InputOTPSlot
                                                                                index={
                                                                                    1
                                                                                }
                                                                                obscured
                                                                            />
                                                                            <InputOTPSlot
                                                                                index={
                                                                                    2
                                                                                }
                                                                                obscured
                                                                            />
                                                                            <InputOTPSlot
                                                                                index={
                                                                                    3
                                                                                }
                                                                                obscured
                                                                            />
                                                                            <InputOTPSlot
                                                                                index={
                                                                                    4
                                                                                }
                                                                                obscured
                                                                            />
                                                                            <InputOTPSlot
                                                                                index={
                                                                                    5
                                                                                }
                                                                                obscured
                                                                            />
                                                                        </InputOTPGroup>
                                                                    </InputOTP>
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                {pincodeError && (
                                                    <Alert variant="destructive">
                                                        <AlertDescription>
                                                            {pincodeError}
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                                <Button
                                                    type="submit"
                                                    className="w-full"
                                                    loading={loadingLogin}
                                                    disabled={loadingLogin}
                                                >
                                                    <LockIcon className="w-4 h-4 mr-2" />
                                                    {t("pincodeSubmit")}
                                                </Button>
                                            </form>
                                        </Form>
                                    </TabsContent>
                                )}
                                {props.methods.password && (
                                    <TabsContent
                                        value="password"
                                        className={`${numMethods <= 1 ? "mt-0" : ""}`}
                                    >
                                        <Form {...passwordForm}>
                                            <form
                                                onSubmit={passwordForm.handleSubmit(
                                                    onPasswordSubmit
                                                )}
                                                className="space-y-4"
                                            >
                                                <FormField
                                                    control={
                                                        passwordForm.control
                                                    }
                                                    name="password"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                {t("password")}
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="password"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                {passwordError && (
                                                    <Alert variant="destructive">
                                                        <AlertDescription>
                                                            {passwordError}
                                                        </AlertDescription>
                                                    </Alert>
                                                )}

                                                <Button
                                                    type="submit"
                                                    className="w-full"
                                                    loading={loadingLogin}
                                                    disabled={loadingLogin}
                                                >
                                                    <LockIcon className="w-4 h-4 mr-2" />
                                                    {t("passwordSubmit")}
                                                </Button>
                                            </form>
                                        </Form>
                                    </TabsContent>
                                )}
                                {props.methods.sso && (
                                    <TabsContent
                                        value="sso"
                                        className={`${numMethods <= 1 ? "mt-0" : ""}`}
                                    >
                                        <LoginForm
                                            idps={props.idps}
                                            redirect={props.redirect}
                                            onLogin={async () =>
                                                await handleSSOAuth()
                                            }
                                        />
                                    </TabsContent>
                                )}
                                {props.methods.whitelist && (
                                    <TabsContent
                                        value="whitelist"
                                        className={`${numMethods <= 1 ? "mt-0" : ""}`}
                                    >
                                        {otpState === "idle" && (
                                            <Form {...requestOtpForm}>
                                                <form
                                                    onSubmit={requestOtpForm.handleSubmit(
                                                        onWhitelistSubmit
                                                    )}
                                                    className="space-y-4"
                                                >
                                                    <FormField
                                                        control={
                                                            requestOtpForm.control
                                                        }
                                                        name="email"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    {t("email")}
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="email"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                                <FormDescription>
                                                                    {t(
                                                                        "otpEmailDescription"
                                                                    )}
                                                                </FormDescription>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    {whitelistError && (
                                                        <Alert variant="destructive">
                                                            <AlertDescription>
                                                                {whitelistError}
                                                            </AlertDescription>
                                                        </Alert>
                                                    )}

                                                    <Button
                                                        type="submit"
                                                        className="w-full"
                                                        loading={loadingLogin}
                                                        disabled={loadingLogin}
                                                    >
                                                        <Send className="w-4 h-4 mr-2" />
                                                        {t("otpEmailSend")}
                                                    </Button>
                                                </form>
                                            </Form>
                                        )}

                                        {otpState === "otp_sent" && (
                                            <Form {...submitOtpForm}>
                                                <form
                                                    onSubmit={submitOtpForm.handleSubmit(
                                                        onWhitelistSubmit
                                                    )}
                                                    className="space-y-4"
                                                >
                                                    <FormField
                                                        control={
                                                            submitOtpForm.control
                                                        }
                                                        name="otp"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    {t(
                                                                        "otpEmail"
                                                                    )}
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="password"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    {whitelistError && (
                                                        <Alert variant="destructive">
                                                            <AlertDescription>
                                                                {whitelistError}
                                                            </AlertDescription>
                                                        </Alert>
                                                    )}

                                                    <Button
                                                        type="submit"
                                                        className="w-full"
                                                        loading={loadingLogin}
                                                        disabled={loadingLogin}
                                                    >
                                                        <LockIcon className="w-4 h-4 mr-2" />
                                                        {t("otpEmailSubmit")}
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        className="w-full"
                                                        variant={"outline"}
                                                        onClick={() => {
                                                            setOtpState("idle");
                                                            submitOtpForm.reset();
                                                        }}
                                                    >
                                                        {t("backToEmail")}
                                                    </Button>
                                                </form>
                                            </Form>
                                        )}
                                    </TabsContent>
                                )}
                            </Tabs>
                        </CardContent>
                    </Card>
                    {supporterStatus?.visible && (
                        <div className="text-center mt-2">
                            <span className="text-sm text-muted-foreground opacity-50">
                                {t("noSupportKey")}
                            </span>
                        </div>
                    )}
                </div>
            ) : (
                <ResourceAccessDenied />
            )}
        </div>
    );
}
