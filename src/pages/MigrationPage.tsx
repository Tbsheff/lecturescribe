import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { migrateNotesToBucket } from "@/services/migrationService";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const MigrationPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    success?: boolean;
    count?: number;
    errors?: string[];
  }>({});

  const handleMigration = async () => {
    if (!user) {
      toast.error("You must be logged in to migrate notes");
      return;
    }

    try {
      setIsMigrating(true);
      const result = await migrateNotesToBucket(user.id);
      setMigrationResult(result);

      if (result.success) {
        toast.success(
          `Successfully migrated ${result.count} notes to the new storage system`,
        );
      } else {
        toast.error("Migration completed with errors");
      }
    } catch (error: any) {
      console.error("Migration error:", error);
      toast.error(`Migration failed: ${error.message}`);
      setMigrationResult({
        success: false,
        count: 0,
        errors: [error.message],
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 gradient-text">
          Storage Migration
        </h1>
        <p className="text-muted-foreground mb-8">
          Migrate your notes to the new storage system
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Migrate Notes</CardTitle>
            <CardDescription>
              This will move your notes from the database to the new storage
              bucket system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p>
                We've updated our storage system to improve performance and
                reliability. This migration will move your existing notes to the
                new system without losing any data.
              </p>

              <div className="flex flex-col space-y-2">
                <h3 className="font-medium">
                  Benefits of the new storage system:
                </h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Improved performance and faster loading times</li>
                  <li>Better organization of note content and audio files</li>
                  <li>Enhanced security for your data</li>
                  <li>Support for larger files and more complex notes</li>
                </ul>
              </div>

              {migrationResult.success === true && (
                <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertTitle>Migration Successful</AlertTitle>
                  <AlertDescription>
                    {migrationResult.count} notes were successfully migrated to
                    the new storage system.
                  </AlertDescription>
                </Alert>
              )}

              {migrationResult.success === false && (
                <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertTitle>Migration Completed with Errors</AlertTitle>
                  <AlertDescription>
                    <p>Successfully migrated: {migrationResult.count} notes</p>
                    <p>Errors:</p>
                    <ul className="list-disc pl-6 mt-2">
                      {migrationResult.errors?.map((error, index) => (
                        <li key={index} className="text-sm">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => navigate("/")}>
                  Back to Home
                </Button>

                <Button
                  onClick={handleMigration}
                  disabled={isMigrating}
                  className="bg-brand hover:bg-brand-dark text-white"
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Migrating...
                    </>
                  ) : (
                    <>
                      Start Migration
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default MigrationPage;
